#!/usr/bin/env ruby
#
# Keep the Markdown source of each post (with Liquid already rendered,
# e.g. `post_url` resolved) as `post.markdown` for llms-full.txt

Jekyll::Hooks.register :posts, :pre_render do |post, payload|

  markdown = post.content

  if post.render_with_liquid?
    info = { :registers => { :site => post.site, :page => payload['page'] } }
    renderer = Jekyll::Renderer.new(post.site, post, payload)
    markdown = renderer.render_liquid(markdown, payload, info, post.path)
  end

  post.data['markdown'] = markdown

end
