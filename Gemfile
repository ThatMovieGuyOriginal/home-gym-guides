# frozen_string_literal: true

source "https://rubygems.org"

# Specify the Jekyll version
gem "jekyll", "~> 4.3"

# Platform-specific gems (Windows)
gem 'wdm', '>= 0.1.0' if Gem.win_platform?

# Essential plugins for Jekyll site functionality
group :jekyll_plugins do
  gem "jekyll-feed"       # Generates an Atom feed for the site
  gem "jekyll-sitemap"    # Automatically generates a sitemap
  gem "jekyll-paginate"   # Supports pagination for listing content
  gem "jekyll-seo-tag"    # Adds SEO tags to improve visibility
  gem "jekyll-archives"   # Allows archive pages for content by category, tag, or date
end

# Timezone support, useful if your site needs timezone data
gem "tzinfo-data"
gem "tzinfo"

# Add CSV and Base64 for compatibility with future Ruby versions
gem "csv"      # Explicitly required as of Ruby 3.4.0+
gem "base64"   # Explicitly required as of Ruby 3.4.0+
