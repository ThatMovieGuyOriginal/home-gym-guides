# Home Gym Guides

A comprehensive Jekyll-based website for home gym equipment reviews, fitness guides, and expert advice.

## Features

- 🏋️‍♀️ Expert home gym equipment reviews
- 📱 Fully responsive design for all devices
- 🔎 SEO optimized with structured data
- 🚀 Progressive Web App (PWA) capabilities
- 📊 Enhanced analytics tracking
- 🍪 GDPR compliant cookie consent
- 🖼️ Responsive image optimization
- 💰 Affiliate marketing integration
- 📧 Newsletter signup forms

## Getting Started

### Prerequisites

- Ruby 2.7 or higher
- Bundler
- NodeJS 12 or higher
- NPM

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/home-gym-guides.git
   cd home-gym-guides
   ```

2. Install Ruby dependencies
   ```
   bundle install
   ```

3. Install Node dependencies
   ```
   npm install
   ```

4. Run the development server
   ```
   bundle exec jekyll serve
   ```

5. Visit `http://localhost:4000` in your browser

## Image Optimization

Optimize all images before deployment:

```
npm run optimize-images
```

This script will:
- Create responsive image sizes for different devices
- Optimize images for web performance
- Generate WebP versions for modern browsers

## Building for Production

```
npm run build
```

This will:
1. Optimize all images
2. Build the Jekyll site
3. Generate the service worker
4. Prepare for deployment

## Deployment

The site is set up to deploy to Vercel using GitHub Actions. The workflow file is in `.github/workflows/deploy.yml`.

To deploy to Vercel:

1. Push to the main branch
2. GitHub Actions will build the site and deploy to Vercel
3. Visit your Vercel dashboard to see the deployment

## Project Structure

- `_includes/` - Reusable HTML components
- `_layouts/` - Page templates
- `_posts/` - Blog posts and reviews
- `_category/` - Category pages
- `_equipment/` - Equipment type pages
- `assets/` - Static assets (CSS, JS, images)
- `pages/` - Main site pages
- `scripts/` - Build and optimization scripts

## Content Generation

To automate content generation:

1. Use the markdown templates in `_templates/`
2. Run the content generator script:
   ```
   node scripts/generate-content.js
   ```

This will create new posts or pages based on the templates and your specifications.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details.

## Acknowledgments

- Jekyll theme based on [Affiliates Jekyll Theme](https://github.com/wowthemesnet/affiliates-jekyll-theme)
- Icons from [Font Awesome](https://fontawesome.com/)
- Product images used with permission from respective manufacturers
