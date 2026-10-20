#!/usr/bin/env ruby
#
# Posts with `draft: true` in their front matter stay published, but get a
# notice at the top. German posts (lang: de-DE) get the German text.
# Runs before posts-markdown-hook.rb, so llms-full.txt contains the notice too.

DRAFT_NOTICES = {
  'en'    => '**Draft:** This article isn\'t finished yet.',
  'de-DE' => '**Entwurf:** Dieser Beitrag ist noch nicht fertig.'
}.freeze

Jekyll::Hooks.register :posts, :pre_render, priority: :high do |post|

  next unless post.data['draft']

  notice = DRAFT_NOTICES[post.data['lang']] || DRAFT_NOTICES['en']
  post.content = "> #{notice}\n{: .prompt-warning }\n\n#{post.content}"

end
