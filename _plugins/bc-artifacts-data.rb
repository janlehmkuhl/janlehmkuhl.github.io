#!/usr/bin/env ruby
#
# Download the Business Central artifact indexes at build time and publish
# compact snapshots for the tools: /assets/data/bc-artifacts.json (Artifact
# Builder) and /assets/data/bc-releases.json (Release Map).
# Microsoft's CDN sends no CORS headers, so the browser can't query it directly.

require 'json'
require 'net/http'
require 'set'
require 'time'
require 'fileutils'

module BcArtifacts
  HOSTS = {
    'bcartifacts' => 'bcartifacts-exdbf9fwegejdqak.b02.azurefd.net',
    'bcinsider'   => 'bcinsider-fvh2ekdjecfjd6gk.b02.azurefd.net'
  }.freeze
  SOURCES = [%w[bcartifacts sandbox], %w[bcartifacts onprem], %w[bcinsider sandbox]].freeze
  CACHE_TTL = 6 * 3600
  THREADS = 8

  module_function

  def fetch_json(url)
    response = Net::HTTP.get_response(URI(url))
    return nil unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body.force_encoding('UTF-8').delete_prefix("﻿"))
  end

  def fetch_all(urls)
    queue = Queue.new
    urls.each { |key, url| queue << [key, url] }
    results = {}
    mutex = Mutex.new
    Array.new(THREADS) do
      Thread.new do
        until queue.empty?
          key, url = begin
            queue.pop(true)
          rescue ThreadError
            break
          end
          data = fetch_json(url)
          mutex.synchronize { results[key] = data }
        end
      end
    end.each(&:join)
    results
  end

  def version_key(version)
    version.split('.').map(&:to_i)
  end

  def major_minor(version)
    version.split('.').first(2).join('.')
  end

  # First build per major.minor as [major.minor, epoch seconds, version], oldest first
  def first_builds(entries)
    entries.group_by { |e| major_minor(e['Version']) }
           .map do |mm, builds|
             first = builds.min_by { |e| e['CreationTime'] }
             [mm, Time.parse(first['CreationTime']).to_i, first['Version']]
           end
           .sort_by { |mm, _, _| version_key(mm) }
  end

  # versions: sorted union of all versions that also exist in the platform index
  # countries: per country the indexes of versions it lacks, and creation times
  #            (epoch seconds) for its newest major.minor (needed for daily/weekly)
  def build_source(account, type)
    base = "https://#{HOSTS[account]}/#{type}/indexes"
    countries = fetch_json("#{base}/countries.json")
    raise "no country index for #{account}/#{type}" unless countries

    indexes = fetch_all((countries | ['platform']).map { |c| [c, "#{base}/#{c}.json"] })
    platform = (indexes.delete('platform') || []).map { |e| e['Version'] }.to_set
    indexes.compact!
    indexes.transform_values! { |entries| entries.select { |e| platform.include?(e['Version']) } }

    versions = indexes.values.flatten.map { |e| e['Version'] }.uniq.sort_by { |v| version_key(v) }
    position = versions.each_with_index.to_h

    result = {}
    indexes.sort.each do |country, entries|
      next if entries.empty?

      present = entries.map { |e| position[e['Version']] }.to_set
      newest = entries.max_by { |e| version_key(e['Version']) }['Version']
      times = entries.select { |e| major_minor(e['Version']) == major_minor(newest) }
                     .to_h { |e| [position[e['Version']], Time.parse(e['CreationTime']).to_i] }
      result[country] = {
        'missing' => (0...versions.size).reject { |i| present.include?(i) },
        'times'   => times
      }
    end
    { 'versions' => versions, 'countries' => result, 'releases' => first_builds(indexes['w1'] || []) }
  end

  # On-premises artifacts keep their original creation dates (one build per cumulative
  # update), so they date each release. Sandbox indexes are republished and can't.
  def download
    sources = SOURCES.to_h { |account, type| ["#{account}/#{type}", build_source(account, type)] }
    releases = {
      'onprem'  => sources['bcartifacts/onprem'].delete('releases'),
      'insider' => sources['bcinsider/sandbox'].delete('releases')
    }
    sources.each_value { |src| src.delete('releases') }
    { 'generated' => Time.now.utc.iso8601, 'sources' => sources, 'releases' => releases }
  end

  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      cache_file = File.join(site.source, '.jekyll-cache', 'bc-artifacts.json')
      data = cached(cache_file)
      data = nil if data && !data['releases']

      unless data
        begin
          data = BcArtifacts.download
          FileUtils.mkdir_p(File.dirname(cache_file))
          File.write(cache_file, JSON.generate(data))
          Jekyll.logger.info 'BC artifacts:', 'index snapshot downloaded'
        rescue StandardError => e
          Jekyll.logger.warn 'BC artifacts:', "download failed (#{e.message})"
          data = cached(cache_file, ignore_ttl: true) || { 'generated' => nil, 'sources' => {}, 'releases' => {} }
        end
      end

      publish(site, 'bc-artifacts.json', 'generated' => data['generated'], 'sources' => data['sources'])
      publish(site, 'bc-releases.json', { 'generated' => data['generated'] }.merge(data['releases'] || {}))
    end

    private

    def publish(site, name, content)
      page = Jekyll::PageWithoutAFile.new(site, site.source, 'assets/data', name)
      page.content = JSON.generate(content)
      page.data['layout'] = nil
      page.data['sitemap'] = false
      page.data['render_with_liquid'] = false
      site.pages << page
    end

    def cached(file, ignore_ttl: false)
      return nil unless File.exist?(file)
      return nil unless ignore_ttl || Time.now - File.mtime(file) < BcArtifacts::CACHE_TTL

      JSON.parse(File.read(file))
    rescue JSON::ParserError
      nil
    end
  end
end
