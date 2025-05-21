#!/usr/bin/env node

/**
 * Enhanced Content Generator for Home Gym Guides
 * 
 * This script fully automates the content creation process:
 * - Generates blog posts, product reviews, and equipment pages
 * - Creates optimized images
 * - Schedules content publication
 * - Handles SEO metadata
 * - Updates site navigation
 * 
 * Usage: node generate-content.js [command] [options]
 * Commands:
 *   generate  - Generate content
 *   schedule  - Schedule content
 *   publish   - Publish scheduled content
 *   batch     - Create content in batch mode
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execSync } = require('child_process');
const axios = require('axios');
const sharp = require('sharp');
const yaml = require('js-yaml');
const cron = require('node-cron');
const { program } = require('commander');
const inquirer = require('inquirer');
const { Configuration, OpenAIApi } = require('openai');

// Promisify fs functions
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Configuration
const CONFIG = {
  openAI: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4-1106-preview",
    maxTokens: 4000
  },
  contentTypes: {
    post: {
      template: '_templates/post-template.md',
      outputDir: '_posts',
      datePrefix: true,
      imageDir: 'assets/images/posts',
      seoPrompt: 'Write SEO-optimized metadata for a blog post about: '
    },
    review: {
      template: '_templates/review-template.md',
      outputDir: '_posts',
      datePrefix: true,
      imageDir: 'assets/images/reviews',
      seoPrompt: 'Write SEO-optimized metadata for a product review about: '
    },
    equipment: {
      template: '_templates/equipment-template.md',
      outputDir: '_equipment',
      datePrefix: false,
      imageDir: 'assets/images/equipment',
      seoPrompt: 'Write SEO-optimized metadata for an equipment guide about: '
    },
    category: {
      template: '_templates/category-template.md',
      outputDir: '_category',
      datePrefix: false,
      imageDir: 'assets/images/categories',
      seoPrompt: 'Write SEO-optimized metadata for a category page about: '
    }
  },
  publishing: {
    scheduledDir: '.scheduled',
    postsPerWeek: 3,
    publishingDays: ['Monday', 'Wednesday', 'Friday'],
    socialMedia: {
      enabled: false,
      platforms: ['twitter', 'facebook', 'instagram']
    }
  },
  seo: {
    minTitleLength: 30,
    maxTitleLength: 60,
    minDescriptionLength: 120,
    maxDescriptionLength: 160,
    minContentLength: 800
  },
  imageGeneration: {
    enabled: true,
    apiKey: process.env.UNSPLASH_API_KEY,
    placeholderUrl: 'https://source.unsplash.com/random/1200x800/?{query}'
  }
};

// Initialize OpenAI
let openai;
if (CONFIG.openAI.apiKey) {
  const configuration = new Configuration({
    apiKey: CONFIG.openAI.apiKey
  });
  openai = new OpenAIApi(configuration);
}

// Setup Commander CLI
program
  .version('1.0.0')
  .description('Automated content generator for Home Gym Guides');

program
  .command('generate')
  .description('Generate new content')
  .option('-t, --type <type>', 'Content type (post, review, equipment, category)')
  .option('-i, --title <title>', 'Content title')
  .option('-c, --categories <categories>', 'Categories (comma-separated)')
  .option('-g, --tags <tags>', 'Tags (comma-separated)')
  .option('-a, --author <author>', 'Author ID')
  .option('-f, --featured', 'Featured content')
  .option('-s, --seo', 'Auto-generate SEO metadata', true)
  .option('-m, --image', 'Auto-generate images', true)
  .option('-x, --publish', 'Publish immediately', false)
  .option('-b, --batch <file>', 'Batch file with content details')
  .action(handleGenerate);

program
  .command('schedule')
  .description('Schedule content for future publication')
  .option('-d, --date <date>', 'Publication date (YYYY-MM-DD)')
  .option('-f, --file <file>', 'Content file to schedule')
  .action(handleSchedule);

program
  .command('publish')
  .description('Publish scheduled content')
  .option('-d, --date <date>', 'Publish content scheduled for this date (YYYY-MM-DD)')
  .option('-a, --all', 'Publish all scheduled content')
  .action(handlePublish);

program
  .command('batch')
  .description('Create content in batch mode from CSV or JSON file')
  .argument('<file>', 'File with content details')
  .option('-s, --schedule', 'Schedule content for future dates')
  .action(handleBatch);

program
  .command('setup-cron')
  .description('Setup cron jobs for automated publishing')
  .action(handleSetupCron);

program
  .command('update-navigation')
  .description('Update site navigation based on content')
  .action(handleUpdateNavigation);

program
  .command('interactive')
  .description('Run in interactive mode')
  .action(handleInteractive);

// Main function
async function main() {
  try {
    // Setup required directories
    await setupDirectories();
    
    // Parse command line args
    program.parse(process.argv);
    
    // If no args, show help
    if (process.argv.length <= 2) {
      program.help();
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Setup required directories
async function setupDirectories() {
  // Create scheduled directory if it doesn't exist
  if (!fs.existsSync(CONFIG.publishing.scheduledDir)) {
    await mkdir(CONFIG.publishing.scheduledDir, { recursive: true });
  }
  
  // Create image directories
  for (const type in CONFIG.contentTypes) {
    const imageDir = CONFIG.contentTypes[type].imageDir;
    if (!fs.existsSync(imageDir)) {
      await mkdir(imageDir, { recursive: true });
    }
  }
}

// Generate content handler
async function handleGenerate(options) {
  try {
    // Interactive mode if no options provided
    if (!options.type && !options.batch) {
      return handleInteractive();
    }
    
    // Batch mode
    if (options.batch) {
      return handleBatch(options.batch);
    }
    
    // Get content type
    const contentType = options.type;
    if (!CONFIG.contentTypes[contentType]) {
      console.error(`Error: Invalid content type "${contentType}"`);
      process.exit(1);
    }
    
    // Get title and other metadata
    const title = options.title;
    if (!title) {
      console.error('Error: Title is required');
      process.exit(1);
    }
    
    // Prepare metadata
    const metadata = {
      categories: options.categories || '',
      tags: options.tags || '',
      author: options.author || 'admin',
      featured: options.featured || false
    };
    
    // For specific content types
    if (contentType === 'equipment') {
      const [category, subcategory] = (options.categories || '').split(',');
      metadata.category = category || '';
      metadata.subcategory = subcategory || '';
    }
    
    // Generate SEO metadata if requested
    if (options.seo) {
      const seoMetadata = await generateSEOMetadata(contentType, title);
      Object.assign(metadata, seoMetadata);
    }
    
    // Generate content with AI
    let generatedContent = '';
    if (CONFIG.openAI.apiKey) {
      console.log('Generating content with AI...');
      generatedContent = await generateAIContent(contentType, title, metadata);
    } else {
      console.log('OpenAI API key not configured. Skipping content generation.');
    }
    
    // Generate or fetch image if requested
    if (options.image && CONFIG.imageGeneration.enabled) {
      console.log('Generating image...');
      const imagePath = await generateImage(contentType, title, metadata);
      if (imagePath) {
        metadata.image = imagePath;
      }
    }
    
    // Create the content file
    const filePath = await createContentFile(contentType, title, metadata, generatedContent);
    
    // Publish or schedule
    if (options.publish) {
      console.log('Publishing content...');
      // In Jekyll context, "publishing" means moving the file to the appropriate directory
      console.log('Content published!');
    } else {
      console.log('Content created but not published.');
      console.log('Use "schedule" command to schedule for future publication.');
    }
    
    console.log(`\nContent created successfully at: ${filePath} 🎉`);
  } catch (error) {
    console.error('Error generating content:', error);
    process.exit(1);
  }
}

// Schedule content handler
async function handleSchedule(options) {
  try {
    if (!options.file) {
      console.error('Error: File path is required');
      process.exit(1);
    }
    
    if (!options.date) {
      // Suggest next publishing date based on schedule
      options.date = getNextPublishingDate();
      console.log(`No date provided. Scheduling for next available date: ${options.date}`);
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      console.error('Error: Date must be in YYYY-MM-DD format');
      process.exit(1);
    }
    
    // Read file
    const filePath = options.file;
    const fileName = path.basename(filePath);
    const content = await readFile(filePath, 'utf8');
    
    // Create directory for scheduled date if it doesn't exist
    const scheduledDateDir = path.join(CONFIG.publishing.scheduledDir, options.date);
    if (!fs.existsSync(scheduledDateDir)) {
      await mkdir(scheduledDateDir, { recursive: true });
    }
    
    // Write to scheduled directory
    const scheduledFilePath = path.join(scheduledDateDir, fileName);
    await writeFile(scheduledFilePath, content, 'utf8');
    
    console.log(`Content scheduled for publication on ${options.date}`);
  } catch (error) {
    console.error('Error scheduling content:', error);
    process.exit(1);
  }
}

// Publish scheduled content handler
async function handlePublish(options) {
  try {
    let datesToPublish = [];
    
    if (options.date) {
      // Single date
      datesToPublish.push(options.date);
    } else if (options.all) {
      // All scheduled dates
      const files = await readdir(CONFIG.publishing.scheduledDir);
      datesToPublish = files.filter(file => {
        return fs.statSync(path.join(CONFIG.publishing.scheduledDir, file)).isDirectory() &&
               /^\d{4}-\d{2}-\d{2}$/.test(file);
      });
    } else {
      // Today's date
      const today = new Date().toISOString().split('T')[0];
      datesToPublish.push(today);
    }
    
    if (datesToPublish.length === 0) {
      console.log('No scheduled content to publish.');
      return;
    }
    
    // Publish each date
    for (const date of datesToPublish) {
      const dateDir = path.join(CONFIG.publishing.scheduledDir, date);
      
      if (!fs.existsSync(dateDir)) {
        console.log(`No content scheduled for ${date}`);
        continue;
      }
      
      const files = await readdir(dateDir);
      
      if (files.length === 0) {
        console.log(`No content scheduled for ${date}`);
        continue;
      }
      
      console.log(`Publishing ${files.length} item(s) scheduled for ${date}...`);
      
      for (const file of files) {
        const scheduledFilePath = path.join(dateDir, file);
        const content = await readFile(scheduledFilePath, 'utf8');
        
        // Extract content type from frontmatter
        const frontMatter = extractFrontMatter(content);
        let contentType = 'post'; // Default
        
        if (frontMatter.layout === 'page') {
          if (scheduledFilePath.includes('equipment')) {
            contentType = 'equipment';
          } else if (scheduledFilePath.includes('category')) {
            contentType = 'category';
          }
        } else if (frontMatter.categories && 
                  (frontMatter.categories.includes('Review') || 
                   frontMatter.categories.includes('review'))) {
          contentType = 'review';
        }
        
        // Determine target file path
        const outputDir = CONFIG.contentTypes[contentType].outputDir;
        const targetFilePath = path.join(outputDir, file);
        
        // Update publication date in content
        const updatedContent = updatePublicationDate(content, date);
        
        // Write to target directory
        await writeFile(targetFilePath, updatedContent, 'utf8');
        
        console.log(`Published: ${targetFilePath}`);
        
        // Remove from scheduled directory
        fs.unlinkSync(scheduledFilePath);
      }
      
      // Remove date directory if empty
      const remainingFiles = await readdir(dateDir);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(dateDir);
      }
    }
    
    console.log('Content publishing complete!');
    
    // Update navigation if configured
    await handleUpdateNavigation();
  } catch (error) {
    console.error('Error publishing content:', error);
    process.exit(1);
  }
}

// Batch content creation handler
async function handleBatch(filePath, options = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File ${filePath} does not exist`);
      process.exit(1);
    }
    
    // Read batch file
    const content = await readFile(filePath, 'utf8');
    let items = [];
    
    // Parse file (CSV or JSON)
    if (filePath.endsWith('.json')) {
      items = JSON.parse(content);
    } else if (filePath.endsWith('.csv')) {
      // Simple CSV parsing
      const lines = content.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const item = {};
        
        headers.forEach((header, index) => {
          item[header] = values[index] || '';
        });
        
        items.push(item);
      }
    } else {
      console.error('Error: Batch file must be CSV or JSON');
      process.exit(1);
    }
    
    if (items.length === 0) {
      console.log('No items found in batch file.');
      return;
    }
    
    // Generate content for each item
    console.log(`Processing ${items.length} items from batch file...`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`\nProcessing item ${i + 1}/${items.length}: ${item.title}`);
      
      if (!item.title || !item.type) {
        console.log('Skipping item: missing required fields (title, type)');
        continue;
      }
      
      // Prepare metadata
      const metadata = {
        categories: item.categories || '',
        tags: item.tags || '',
        author: item.author || 'admin',
        featured: item.featured === 'true' || item.featured === true
      };
      
      // For specific content types
      if (item.type === 'equipment') {
        const [category, subcategory] = (item.categories || '').split(',');
        metadata.category = category || '';
        metadata.subcategory = subcategory || '';
      }
      
      // Generate SEO metadata if not provided
      if (!item.description) {
        const seoMetadata = await generateSEOMetadata(item.type, item.title);
        Object.assign(metadata, seoMetadata);
      } else {
        metadata.description = item.description;
      }
      
      // Generate content with AI
      let generatedContent = '';
      if (CONFIG.openAI.apiKey) {
        console.log('Generating content with AI...');
        generatedContent = await generateAIContent(item.type, item.title, metadata);
      } else {
        console.log('OpenAI API key not configured. Skipping content generation.');
      }
      
      // Generate or fetch image
      if (CONFIG.imageGeneration.enabled) {
        console.log('Generating image...');
        const imagePath = await generateImage(item.type, item.title, metadata);
        if (imagePath) {
          metadata.image = imagePath;
        }
      }
      
      // Create the content file
      const filePath = await createContentFile(item.type, item.title, metadata, generatedContent);
      
      // Schedule if requested
      if (options.schedule) {
        const publishDate = item.publishDate || getNextPublishingDate(i);
        await handleSchedule({ file: filePath, date: publishDate });
      }
      
      console.log(`Created: ${filePath}`);
    }
    
    console.log('\nBatch processing complete!');
  } catch (error) {
    console.error('Error processing batch file:', error);
    process.exit(1);
  }
}

// Setup cron jobs handler
async function handleSetupCron() {
  try {
    console.log('Setting up cron jobs for automated publishing...');
    
    // Publish daily at 8:00 AM
    cron.schedule('0 8 * * *', () => {
      console.log('Running scheduled publication...');
      handlePublish({ date: new Date().toISOString().split('T')[0] });
    });
    
    // Weekly content generation suggestion (e.g., every Monday at 10:00 AM)
    cron.schedule('0 10 * * 1', () => {
      console.log('Generating content suggestions for the week...');
      suggestWeeklyContent();
    });
    
    console.log('Cron jobs set up successfully!');
    console.log('Note: This process must stay running for cron jobs to execute.');
    console.log('Consider using PM2 or similar tool for production use.');
  } catch (error) {
    console.error('Error setting up cron jobs:', error);
    process.exit(1);
  }
}

// Update site navigation handler
async function handleUpdateNavigation() {
  try {
    console.log('Updating site navigation...');
    
    // Read categories
    const categoryFiles = await readdir('_category');
    const categories = [];
    
    for (const file of categoryFiles) {
      if (!file.endsWith('.md')) continue;
      
      const content = await readFile(path.join('_category', file), 'utf8');
      const frontMatter = extractFrontMatter(content);
      
      if (frontMatter.title && frontMatter.permalink) {
        categories.push({
          title: frontMatter.title.replace(/["|']/g, '').split('|')[0].trim(),
          url: frontMatter.permalink.replace(/["|']/g, '')
        });
      }
    }
    
    // Update navigation YAML file
    const menusPath = '_data/menus.yml';
    let menusContent = '';
    
    if (fs.existsSync(menusPath)) {
      menusContent = await readFile(menusPath, 'utf8');
    }
    
    // Parse YAML
    let menus = yaml.load(menusContent) || {};
    
    // Update topmenu
    if (!menus.topmenu) {
      menus.topmenu = [];
    }
    
    // Add/update categories in topmenu
    categories.forEach(category => {
      const existingIndex = menus.topmenu.findIndex(item => 
        item.url === category.url || item.title === category.title
      );
      
      if (existingIndex >= 0) {
        menus.topmenu[existingIndex] = category;
      } else {
        menus.topmenu.push(category);
      }
    });
    
    // Write updated YAML
    await writeFile(menusPath, yaml.dump(menus), 'utf8');
    
    console.log('Site navigation updated successfully!');
  } catch (error) {
    console.error('Error updating navigation:', error);
    process.exit(1);
  }
}

// Interactive mode handler
async function handleInteractive() {
  try {
    const questions = [
      {
        type: 'list',
        name: 'contentType',
        message: 'What type of content do you want to create?',
        choices: Object.keys(CONFIG.contentTypes)
      },
      {
        type: 'input',
        name: 'title',
        message: 'Enter the title:',
        validate: input => input.trim().length > 0 ? true : 'Title is required'
      },
      {
        type: 'input',
        name: 'categories',
        message: 'Enter categories (comma-separated):',
        when: answers => ['post', 'review'].includes(answers.contentType)
      },
      {
        type: 'input',
        name: 'tags',
        message: 'Enter tags (comma-separated):',
        when: answers => ['post', 'review'].includes(answers.contentType)
      },
      {
        type: 'input',
        name: 'author',
        message: 'Enter author ID:',
        default: 'admin',
        when: answers => ['post', 'review'].includes(answers.contentType)
      },
      {
        type: 'confirm',
        name: 'featured',
        message: 'Is this featured content?',
        default: false
      },
      {
        type: 'input',
        name: 'category',
        message: 'Enter main category:',
        when: answers => answers.contentType === 'equipment'
      },
      {
        type: 'input',
        name: 'subcategory',
        message: 'Enter subcategory:',
        when: answers => answers.contentType === 'equipment'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter description:',
        when: answers => answers.contentType === 'category'
      },
      {
        type: 'input',
        name: 'permalink',
        message: 'Enter permalink:',
        when: answers => answers.contentType === 'category',
        default: answers => `/category/${answers.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}/`
      },
      {
        type: 'confirm',
        name: 'generateContent',
        message: 'Generate content with AI?',
        default: true,
        when: () => !!CONFIG.openAI.apiKey
      },
      {
        type: 'confirm',
        name: 'generateImage',
        message: 'Generate image?',
        default: true,
        when: () => CONFIG.imageGeneration.enabled
      },
      {
        type: 'list',
        name: 'publishOption',
        message: 'How would you like to publish this content?',
        choices: [
          { name: 'Save as draft', value: 'draft' },
          { name: 'Publish immediately', value: 'now' },
          { name: 'Schedule for later', value: 'schedule' }
        ]
      },
      {
        type: 'input',
        name: 'scheduleDate',
        message: 'Enter publication date (YYYY-MM-DD):',
        when: answers => answers.publishOption === 'schedule',
        default: getNextPublishingDate(),
        validate: input => /^\d{4}-\d{2}-\d{2}$/.test(input) ? true : 'Date must be in YYYY-MM-DD format'
      }
    ];
    
    const answers = await inquirer.prompt(questions);
    
    // Prepare metadata
    const metadata = {
      categories: answers.categories || '',
      tags: answers.tags || '',
      author: answers.author || 'admin',
      featured: answers.featured || false
    };
    
    // For specific content types
    if (answers.contentType === 'equipment') {
      metadata.category = answers.category || '';
      metadata.subcategory = answers.subcategory || '';
    } else if (answers.contentType === 'category') {
      metadata.description = answers.description || '';
      metadata.permalink = answers.permalink || '';
    }
    
    // Generate SEO metadata
    const seoMetadata = await generateSEOMetadata(answers.contentType, answers.title);
    Object.assign(metadata, seoMetadata);
    
    // Generate content with AI if requested
    let generatedContent = '';
    if (answers.generateContent) {
      console.log('Generating content with AI...');
      generatedContent = await generateAIContent(answers.contentType, answers.title, metadata);
    }
    
    // Generate or fetch image if requested
    if (answers.generateImage) {
      console.log('Generating image...');
      const imagePath = await generateImage(answers.contentType, answers.title, metadata);
      if (imagePath) {
        metadata.image = imagePath;
      }
    }
    
    // Create the content file
    const filePath = await createContentFile(answers.contentType, answers.title, metadata, generatedContent);
    
    // Handle publishing option
    if (answers.publishOption === 'now') {
      console.log('Publishing content immediately...');
      // For Jekyll, publishing means the file is in the correct location with the correct frontmatter
      console.log('Content published!');
    } else if (answers.publishOption === 'schedule') {
      await handleSchedule({ file: filePath, date: answers.scheduleDate });
    } else {
      console.log('Content saved as draft.');
    }
    
    console.log(`\nContent created successfully at: ${filePath} 🎉`);
  } catch (error) {
    console.error('Error in interactive mode:', error);
    process.exit(1);
  }
}

// Suggest weekly content
async function suggestWeeklyContent() {
  try {
    // If no OpenAI API key, skip
    if (!CONFIG.openAI.apiKey) {
      console.log('OpenAI API key not configured. Skipping content suggestions.');
      return;
    }
    
    console.log('Generating content suggestions for the week...');
    
    // Analyze existing content to avoid duplication
    const existingTitles = await getExistingContentTitles();
    
    // Generate content suggestions using AI
    const prompt = `
    As a content strategist for a home gym fitness blog, suggest 5 articles for next week's content.
    
    The blog focuses on:
    - Home gym equipment reviews
    - Workout routines for home gyms
    - Space-saving fitness solutions
    - Budget-friendly fitness equipment
    
    Existing article titles include: ${existingTitles.slice(0, 20).join(', ')}
    
    For each suggested article, provide:
    1. Title
    2. Brief description (2-3 sentences)
    3. Target audience
    4. Content type (post, review, equipment guide, category)
    5. Keywords for SEO
    `;
    
    const completion = await openai.createCompletion({
      model: CONFIG.openAI.model,
      prompt: prompt,
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const suggestions = completion.data.choices[0].text.trim();
    
    // Write suggestions to file
    const date = new Date().toISOString().split('T')[0];
    const suggestionsPath = path.join(CONFIG.publishing.scheduledDir, `suggestions_${date}.txt`);
    await writeFile(suggestionsPath, suggestions, 'utf8');
    
    console.log(`Content suggestions generated and saved to: ${suggestionsPath}`);
  } catch (error) {
    console.error('Error generating content suggestions:', error);
  }
}

// Helper function to generate SEO metadata
async function generateSEOMetadata(contentType, title) {
  try {
    // If no OpenAI API key, return empty metadata
    if (!CONFIG.openAI.apiKey) {
      return {
        description: `Learn all about ${title} in our comprehensive guide.`
      };
    }
    
    const prompt = `
    Generate SEO metadata for: "${title}"
    Content type: ${contentType}
    
    Format:
    Title: SEO-optimized title (50-60 characters)
    Description: Meta description (120-160 characters)
    Keywords: comma-separated keywords
    `;
    
    const completion = await openai.createCompletion({
      model: CONFIG.openAI.model,
      prompt: prompt,
      max_tokens: 300,
      temperature: 0.7,
    });
    
    const response = completion.data.choices[0].text.trim();
    
    // Parse response
    const metadata = {};
    
    const titleMatch = response.match(/Title: (.+)/);
    if (titleMatch) {
      metadata.seo_title = titleMatch[1].trim();
    }
    
    const descriptionMatch = response.match(/Description: (.+)/);
    if (descriptionMatch) {
      metadata.description = descriptionMatch[1].trim();
    }
    
    const keywordsMatch = response.match(/Keywords: (.+)/);
    if (keywordsMatch) {
      metadata.keywords = keywordsMatch[1].trim();
    }
    
    return metadata;
  } catch (error) {
    console.error('Error generating SEO metadata:', error);
    return {
      description: `Learn all about ${title} in our comprehensive guide.`
    };
  }
}

// Helper function to generate content with AI
async function generateAIContent(contentType, title, metadata) {
  try {
    // If no OpenAI API key, return placeholder content
    if (!CONFIG.openAI.apiKey) {
      return `# ${title}\n\nPlaceholder content for ${title}. Replace this with your actual content.`;
    }
    
    // Create prompt based on content type
    let prompt = '';
    
    if (contentType === 'post') {
      prompt = `
      Write a comprehensive blog post about "${title}" for a home gym fitness blog.
      
      The post should include:
      - An engaging introduction that hooks the reader
      - 3-5 main sections with helpful information
      - Practical tips and advice for home gym enthusiasts
      - A conclusion with key takeaways
      
      Additional details:
      - Target audience: Home fitness enthusiasts
      - Categories: ${metadata.categories || 'Home Fitness'}
      - Keywords: ${metadata.keywords || title}
      
      Format the content in Markdown with appropriate headings, lists, and emphasis.
      Aim for approximately 1200-1500 words of informative, engaging content.
      `;
    } else if (contentType === 'review') {
      prompt = `
      Write a detailed product review about "${title}" for a home gym equipment blog.
      
      The review should include:
      - Product overview and specifications
      - Pros and cons list
      - Value for money assessment
      - Comparison with similar products
      - Final verdict with rating (out of 10)
      
      Additional details:
      - Categories: ${metadata.categories || 'Reviews, Equipment'}
      - Keywords: ${metadata.keywords || title + ' review'}
      
      Format the content in Markdown with appropriate headings, lists, and emphasis.
      Include a section for technical specifications in a table format.
      Aim for approximately 1500-2000 words of informative, balanced review content.
      `;
    } else if (contentType === 'equipment') {
      prompt = `
      Write a comprehensive equipment guide about "${title}" for a home gym website.
      
      The guide should include:
      - Detailed description and types available
      - Benefits and muscles targeted
      - How to choose the right one for your needs
      - Maintenance and care tips
      - Price ranges and recommendations
      
      Additional details:
      - Main category: ${metadata.category || 'Equipment'}
      - Subcategory: ${metadata.subcategory || 'Guide'}
      - Keywords: ${metadata.keywords || title}
      
      Format the content in Markdown with appropriate headings, lists, and emphasis.
      Include a buyer's guide section and recommended products.
      Aim for approximately 1800-2200 words of informative, detailed content.
      `;
    } else if (contentType === 'category') {
      prompt = `
      Write a category page introduction about "${title}" for a home gym website.
      
      The content should include:
      - Definition and overview of ${title}
      - Why this category is important for home fitness
      - Key considerations when purchasing items in this category
      - Brief overview of subcategories or types
      
      Additional details:
      - Description: ${metadata.description || ''}
      - Keywords: ${metadata.keywords || title}
      
      Format the content in Markdown with appropriate headings and emphasis.
      This will serve as an introduction to a category page, so keep it concise but informative.
      Aim for approximately 500-700 words of engaging, informative content.
      `;
    }
    
    // Generate content
    console.log('Sending prompt to OpenAI...');
    const completion = await openai.createCompletion({
      model: CONFIG.openAI.model,
      prompt: prompt,
      max_tokens: CONFIG.openAI.maxTokens,
      temperature: 0.7,
    });
    
    // Extract and return generated content
    return completion.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error generating content with AI:', error);
    return `# ${title}\n\nUnable to generate content with AI. Please try again later or add your content manually.`;
  }
}

// Helper function to generate or fetch an image
async function generateImage(contentType, title, metadata) {
  try {
    if (!CONFIG.imageGeneration.enabled) {
      return null;
    }
    
    const config = CONFIG.contentTypes[contentType];
    const searchQuery = encodeURIComponent(title.replace(/[^\w\s]/g, ''));
    let imageUrl = '';
    
    // Use Unsplash API if configured, otherwise use placeholder
    if (CONFIG.imageGeneration.apiKey) {
      console.log('Fetching image from Unsplash...');
      const response = await axios.get(`https://api.unsplash.com/search/photos`, {
        params: {
          query: searchQuery,
          orientation: 'landscape',
          per_page: 1
        },
        headers: {
          Authorization: `Client-ID ${CONFIG.imageGeneration.apiKey}`
        }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        imageUrl = response.data.results[0].urls.regular;
      } else {
        // Fallback to placeholder if no results
        imageUrl = CONFIG.imageGeneration.placeholderUrl.replace('{query}', searchQuery);
      }
    } else {
      // Use placeholder
      imageUrl = CONFIG.imageGeneration.placeholderUrl.replace('{query}', searchQuery);
    }
    
    // Download image
    console.log('Downloading image...');
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imageResponse.data, 'binary');
    
    // Generate filename
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    const filename = `${slug}.jpg`;
    const outputPath = path.join(config.imageDir, filename);
    
    // Optimize and save image
    console.log('Optimizing and saving image...');
    await sharp(buffer)
      .resize(1200, 800, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    
    // Return relative path for frontmatter
    const relativePath = `/${config.imageDir}/${filename}`;
    return relativePath;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

// Helper function to create content file
async function createContentFile(contentType, title, metadata, content) {
  try {
    const config = CONFIG.contentTypes[contentType];
    
    // Read template
    let template = '';
    if (fs.existsSync(config.template)) {
      template = await readFile(config.template, 'utf8');
    }
    
    // Generate slug from title
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    
    // Generate filename
    let filename = '';
    if (config.datePrefix) {
      const date = new Date().toISOString().split('T')[0];
      filename = `${date}-${slug}.md`;
    } else {
      filename = `${slug}.md`;
    }
    
    // Create frontmatter
    const frontMatter = {
      layout: contentType === 'post' || contentType === 'review' ? 'post' : 'page',
      title: title,
      date: new Date().toISOString().split('T')[0],
      author: metadata.author || 'admin',
      image: metadata.image || '',
      ...(metadata.seo_title ? { seo_title: metadata.seo_title } : {}),
      ...(metadata.description ? { description: metadata.description } : {}),
      ...(metadata.keywords ? { keywords: metadata.keywords } : {})
    };
    
    // Add content type specific frontmatter
    if (contentType === 'post' || contentType === 'review') {
      frontMatter.categories = metadata.categories.split(',').map(c => c.trim());
      frontMatter.tags = metadata.tags.split(',').map(t => t.trim());
      frontMatter.featured = metadata.featured;
    } else if (contentType === 'equipment') {
      frontMatter.category = metadata.category;
      frontMatter.subcategory = metadata.subcategory;
    } else if (contentType === 'category') {
      frontMatter.permalink = metadata.permalink;
    }
    
    // Convert frontmatter to YAML
    const yamlFrontMatter = yaml.dump(frontMatter);
    
    // Combine frontmatter and content
    const fileContent = `---\n${yamlFrontMatter}---\n\n${content}`;
    
    // Ensure output directory exists
    if (!fs.existsSync(config.outputDir)) {
      await mkdir(config.outputDir, { recursive: true });
    }
    
    // Write file
    const outputPath = path.join(config.outputDir, filename);
    await writeFile(outputPath, fileContent, 'utf8');
    
    return outputPath;
  } catch (error) {
    console.error('Error creating content file:', error);
    throw error;
  }
}

// Helper function to extract frontmatter from content
function extractFrontMatter(content) {
  try {
    const frontMatterRegex = /---\s*([\s\S]*?)\s*---/;
    const match = content.match(frontMatterRegex);
    
    if (match && match[1]) {
      return yaml.load(match[1]);
    }
    
    return {};
  } catch (error) {
    console.error('Error extracting frontmatter:', error);
    return {};
  }
}

// Helper function to update publication date in content
function updatePublicationDate(content, date) {
  try {
    const frontMatterRegex = /---\s*([\s\S]*?)\s*---/;
    const match = content.match(frontMatterRegex);
    
    if (match && match[1]) {
      const frontMatter = yaml.load(match[1]);
      frontMatter.date = date;
      
      const updatedFrontMatter = yaml.dump(frontMatter);
      return content.replace(frontMatterRegex, `---\n${updatedFrontMatter}---`);
    }
    
    return content;
  } catch (error) {
    console.error('Error updating publication date:', error);
    return content;
  }
}

// Helper function to get next publishing date
function getNextPublishingDate(offset = 0) {
  try {
    const today = new Date();
    const days = CONFIG.publishing.publishingDays.map(day => {
      const dayMap = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 0
      };
      return dayMap[day];
    });
    
    // Sort days
    days.sort((a, b) => a - b);
    
    // Find next publishing day
    let nextDay = null;
    const currentDay = today.getDay();
    
    for (const day of days) {
      if (day > currentDay) {
        nextDay = day;
        break;
      }
    }
    
    // If no next day found, use first day of next week
    if (nextDay === null) {
      nextDay = days[0];
    }
    
    // Calculate days to add
    let daysToAdd = nextDay - currentDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    // Add offset (for batch scheduling)
    const offsetWeeks = Math.floor(offset / CONFIG.publishing.postsPerWeek);
    const offsetDays = offsetWeeks * 7;
    
    daysToAdd += offsetDays;
    
    // Calculate next date
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);
    
    return nextDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error calculating next publishing date:', error);
    
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
}

// Helper function to get existing content titles
async function getExistingContentTitles() {
  try {
    const titles = [];
    
    // Get posts
    if (fs.existsSync('_posts')) {
      const files = await readdir('_posts');
      
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const content = await readFile(path.join('_posts', file), 'utf8');
        const frontMatter = extractFrontMatter(content);
        
        if (frontMatter.title) {
          titles.push(frontMatter.title.replace(/["|']/g, ''));
        }
      }
    }
    
    // Get equipment pages
    if (fs.existsSync('_equipment')) {
      const files = await readdir('_equipment');
      
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const content = await readFile(path.join('_equipment', file), 'utf8');
        const frontMatter = extractFrontMatter(content);
        
        if (frontMatter.title) {
          titles.push(frontMatter.title.replace(/["|']/g, ''));
        }
      }
    }
    
    return titles;
  } catch (error) {
    console.error('Error getting existing content titles:', error);
    return [];
  }
}

// Generate content ideas based on analytics data
async function generateContentIdeas() {
  try {
    console.log('Generating content ideas based on analytics...');
    
    let popularKeywords = [];
    let gapAnalysis = [];
    
    // Check if Google Analytics data file exists
    const analyticsPath = '_data/analytics.json';
    if (fs.existsSync(analyticsPath)) {
      const analytics = JSON.parse(await readFile(analyticsPath, 'utf8'));
      
      // Extract popular search terms
      if (analytics.searchTerms) {
        popularKeywords = analytics.searchTerms.slice(0, 10).map(term => term.keyword);
      }
      
      // Extract content gaps
      if (analytics.contentGaps) {
        gapAnalysis = analytics.contentGaps.slice(0, 5);
      }
    } else {
      console.log('No analytics data found, using default keywords');
      popularKeywords = ['home gym', 'dumbbells', 'squat rack', 'kettlebells', 'resistance bands'];
    }
    
    // If OpenAI is configured, generate content ideas
    if (CONFIG.openAI.apiKey) {
      const prompt = `
      Generate 10 content ideas for a home gym fitness blog based on these popular keywords: ${popularKeywords.join(', ')}
      
      For each idea, provide:
      - Title
      - Content type (post, review, equipment guide)
      - Brief description (2-3 sentences)
      - Target audience
      - Potential keywords for SEO
      
      Content gaps to address: ${gapAnalysis.join(', ') || 'budget home equipment, small space workouts'}
      `;
      
      const completion = await openai.createCompletion({
        model: CONFIG.openAI.model,
        prompt: prompt,
        max_tokens: 1500,
        temperature: 0.7,
      });
      
      const ideas = completion.data.choices[0].text.trim();
      
      // Save ideas to file
      const date = new Date().toISOString().split('T')[0];
      const ideasPath = path.join(CONFIG.publishing.scheduledDir, `ideas_${date}.txt`);
      await writeFile(ideasPath, ideas, 'utf8');
      
      console.log(`Content ideas generated and saved to: ${ideasPath}`);
      return ideas;
    } else {
      console.log('OpenAI API key not configured, skipping idea generation');
      return null;
    }
  } catch (error) {
    console.error('Error generating content ideas:', error);
    return null;
  }
}

// Analyze existing content for gaps and opportunities
async function analyzeContentCoverage() {
  try {
    console.log('Analyzing content coverage...');
    
    // Get existing content
    const titles = await getExistingContentTitles();
    const categories = new Set();
    const tags = new Set();
    const contentByCategory = {};
    
    // Process posts to extract categories and tags
    if (fs.existsSync('_posts')) {
      const files = await readdir('_posts');
      
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const content = await readFile(path.join('_posts', file), 'utf8');
        const frontMatter = extractFrontMatter(content);
        
        if (frontMatter.categories) {
          const postCategories = Array.isArray(frontMatter.categories) 
            ? frontMatter.categories 
            : frontMatter.categories.split(',').map(c => c.trim());
          
          postCategories.forEach(category => {
            categories.add(category);
            
            if (!contentByCategory[category]) {
              contentByCategory[category] = 0;
            }
            
            contentByCategory[category]++;
          });
        }
        
        if (frontMatter.tags) {
          const postTags = Array.isArray(frontMatter.tags) 
            ? frontMatter.tags 
            : frontMatter.tags.split(',').map(t => t.trim());
          
          postTags.forEach(tag => tags.add(tag));
        }
      }
    }
    
    // Analyze coverage
    const analysis = {
      totalContent: titles.length,
      categoryCoverage: Object.entries(contentByCategory).map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / titles.length) * 100)
      })),
      underrepresentedCategories: []
    };
    
    // Find underrepresented categories
    const avgContentPerCategory = titles.length / categories.size;
    
    analysis.underrepresentedCategories = Object.entries(contentByCategory)
      .filter(([_, count]) => count < avgContentPerCategory * 0.7)
      .map(([category, count]) => ({
        category,
        count,
        gap: Math.round(avgContentPerCategory - count)
      }));
    
    // Create report
    const report = `
    # Content Coverage Analysis
    
    Generated on: ${new Date().toISOString().split('T')[0]}
    
    ## Overview
    - Total content items: ${analysis.totalContent}
    - Number of categories: ${categories.size}
    - Number of tags: ${tags.size}
    
    ## Category Coverage
    ${analysis.categoryCoverage
      .sort((a, b) => b.count - a.count)
      .map(c => `- ${c.category}: ${c.count} items (${c.percentage}%)`)
      .join('\n')}
    
    ## Underrepresented Categories
    ${analysis.underrepresentedCategories.length > 0 
      ? analysis.underrepresentedCategories
          .sort((a, b) => b.gap - a.gap)
          .map(c => `- ${c.category}: ${c.count} items (suggested to add ${c.gap} more)`)
          .join('\n')
      : '- No underrepresented categories found'
    }
    
    ## Recommendations
    ${analysis.underrepresentedCategories.length > 0 
      ? `Focus on creating content for: ${analysis.underrepresentedCategories.map(c => c.category).join(', ')}`
      : 'Continue with current content distribution strategy'
    }
    `;
    
    // Save report
    const reportPath = path.join(CONFIG.publishing.scheduledDir, 'content_analysis.md');
    await writeFile(reportPath, report, 'utf8');
    
    console.log(`Content analysis completed and saved to: ${reportPath}`);
    return analysis;
  } catch (error) {
    console.error('Error analyzing content coverage:', error);
    return null;
  }
}

// Generate social media posts for new content
async function generateSocialMediaPosts(contentFile) {
  try {
    if (!CONFIG.publishing.socialMedia.enabled) {
      return null;
    }
    
    console.log('Generating social media posts...');
    
    // Read content file
    const content = await readFile(contentFile, 'utf8');
    const frontMatter = extractFrontMatter(content);
    
    // Extract title and description
    const title = frontMatter.title || '';
    const description = frontMatter.description || '';
    
    // If OpenAI is configured, generate social media posts
    if (CONFIG.openAI.apiKey) {
      const prompt = `
      Generate social media posts for a new content piece:
      
      Title: ${title}
      Description: ${description}
      
      Create:
      1. A Twitter post (max 280 characters)
      2. A Facebook post (100-250 words)
      3. An Instagram caption (150-300 characters)
      
      For each post, include:
      - Engaging hook
      - Brief value proposition
      - Call to action
      - Relevant hashtags (for Twitter and Instagram)
      `;
      
      const completion = await openai.createCompletion({
        model: CONFIG.openAI.model,
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.7,
      });
      
      const posts = completion.data.choices[0].text.trim();
      
      // Save posts to file
      const slug = path.basename(contentFile, '.md');
      const postsPath = path.join(CONFIG.publishing.scheduledDir, `social_${slug}.txt`);
      await writeFile(postsPath, posts, 'utf8');
      
      console.log(`Social media posts generated and saved to: ${postsPath}`);
      return posts;
    } else {
      console.log('OpenAI API key not configured, skipping social media post generation');
      return null;
    }
  } catch (error) {
    console.error('Error generating social media posts:', error);
    return null;
  }
}

// Generate an editorial calendar
async function generateEditorialCalendar(months = 3) {
  try {
    console.log(`Generating editorial calendar for the next ${months} months...`);
    
    // Get content ideas
    const ideas = await generateContentIdeas();
    if (!ideas) {
      console.log('No content ideas generated, skipping editorial calendar');
      return null;
    }
    
    // Parse ideas
    const ideaLines = ideas.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./));
    const titles = ideaLines.map(line => {
      const match = line.match(/[-.] (.+?)( \(|:)/);
      return match ? match[1].trim() : line.trim();
    }).filter(title => title.length > 0);
    
    // Calculate publishing schedule
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    
    const publishingDays = CONFIG.publishing.publishingDays.map(day => {
      const dayMap = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 0
      };
      return dayMap[day];
    });
    
    // Generate calendar entries
    const calendar = [];
    let currentDate = new Date(startDate);
    let ideaIndex = 0;
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      if (publishingDays.includes(dayOfWeek)) {
        const dateString = currentDate.toISOString().split('T')[0];
        const title = titles[ideaIndex % titles.length];
        
        calendar.push({
          date: dateString,
          title: title,
          contentType: ideaIndex % 3 === 0 ? 'review' : (ideaIndex % 3 === 1 ? 'equipment' : 'post')
        });
        
        ideaIndex++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Create calendar in markdown
    const calendarMarkdown = `
    # Editorial Calendar: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}
    
    ${calendar.map(entry => `## ${entry.date} (${new Date(entry.date).toLocaleString('en-us', { weekday: 'long' })})
    
    - **Title**: ${entry.title}
    - **Type**: ${entry.contentType}
    `).join('\n')}
    `;
    
    // Save calendar
    const calendarPath = path.join(CONFIG.publishing.scheduledDir, 'editorial_calendar.md');
    await writeFile(calendarPath, calendarMarkdown, 'utf8');
    
    console.log(`Editorial calendar generated and saved to: ${calendarPath}`);
    return calendar;
  } catch (error) {
    console.error('Error generating editorial calendar:', error);
    return null;
  }
}

// Add two additional commands to the program
program
  .command('analyze')
  .description('Analyze existing content for gaps and opportunities')
  .action(analyzeContentCoverage);

program
  .command('ideas')
  .description('Generate content ideas based on analytics')
  .option('-c, --count <number>', 'Number of ideas to generate', 10)
  .action(options => generateContentIdeas(options.count));

program
  .command('calendar')
  .description('Generate an editorial calendar')
  .option('-m, --months <number>', 'Number of months to plan', 3)
  .action(options => generateEditorialCalendar(options.months));

program
  .command('social')
  .description('Generate social media posts for content')
  .argument('<file>', 'Content file to generate posts for')
  .action(file => generateSocialMediaPosts(file));

// Enhanced interactive mode
async function handleInteractive() {
  try {
    // Main menu
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create new content', value: 'create' },
          { name: 'Schedule existing content', value: 'schedule' },
          { name: 'Publish scheduled content', value: 'publish' },
          { name: 'Generate content ideas', value: 'ideas' },
          { name: 'Analyze content coverage', value: 'analyze' },
          { name: 'Generate editorial calendar', value: 'calendar' },
          { name: 'Create batch content', value: 'batch' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (action === 'exit') {
      console.log('Goodbye! 👋');
      return;
    }
    
    // Handle selected action
    switch (action) {
      case 'create':
        await handleCreateContent();
        break;
      case 'schedule':
        await handleScheduleContent();
        break;
      case 'publish':
        await handlePublishContent();
        break;
      case 'ideas':
        await generateContentIdeas();
        break;
      case 'analyze':
        await analyzeContentCoverage();
        break;
      case 'calendar':
        const { months } = await inquirer.prompt([
          {
            type: 'number',
            name: 'months',
            message: 'How many months to plan for?',
            default: 3
          }
        ]);
        await generateEditorialCalendar(months);
        break;
      case 'batch':
        await handleBatchContent();
        break;
    }
    
    // Ask if user wants to continue
    const { continue: shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Would you like to perform another action?',
        default: true
      }
    ]);
    
    if (shouldContinue) {
      await handleInteractive();
    } else {
      console.log('Goodbye! 👋');
    }
  } catch (error) {
    console.error('Error in interactive mode:', error);
    process.exit(1);
  }
}

// Helper function for interactive content scheduling
async function handleScheduleContent() {
  try {
    // Get list of content files
    const contentDirs = [
      '_posts',
      '_equipment',
      '_category'
    ];
    
    const contentFiles = [];
    
    for (const dir of contentDirs) {
      if (fs.existsSync(dir)) {
        const files = await readdir(dir);
        
        for (const file of files) {
          if (file.endsWith('.md')) {
            contentFiles.push(path.join(dir, file));
          }
        }
      }
    }
    
    if (contentFiles.length === 0) {
      console.log('No content files found to schedule.');
      return;
    }
    
    // Sort by modified date (most recent first)
    const filesWithDates = await Promise.all(contentFiles.map(async file => {
      const stats = await stat(file);
      return {
        path: file,
        mtime: stats.mtime
      };
    }));
    
    filesWithDates.sort((a, b) => b.mtime - a.mtime);
    
    const fileChoices = filesWithDates.map(file => ({
      name: `${path.basename(file.path)} (${new Date(file.mtime).toISOString().split('T')[0]})`,
      value: file.path
    }));
    
    // Prompt for file and date
    const { file, date } = await inquirer.prompt([
      {
        type: 'list',
        name: 'file',
        message: 'Select a file to schedule:',
        choices: fileChoices
      },
      {
        type: 'input',
        name: 'date',
        message: 'Enter publication date (YYYY-MM-DD):',
        default: getNextPublishingDate(),
        validate: input => /^\d{4}-\d{2}-\d{2}$/.test(input) ? true : 'Date must be in YYYY-MM-DD format'
      }
    ]);
    
    // Schedule the file
    await handleSchedule({ file, date });
  } catch (error) {
    console.error('Error scheduling content:', error);
  }
}

// Helper function for interactive content publishing
async function handlePublishContent() {
  try {
    // Get scheduled dates
    const scheduledDir = CONFIG.publishing.scheduledDir;
    
    if (!fs.existsSync(scheduledDir)) {
      console.log('No scheduled content found.');
      return;
    }
    
    const dates = await readdir(scheduledDir);
    const validDates = dates.filter(date => {
      return fs.statSync(path.join(scheduledDir, date)).isDirectory() &&
             /^\d{4}-\d{2}-\d{2}$/.test(date);
    });
    
    if (validDates.length === 0) {
      console.log('No scheduled content found.');
      return;
    }
    
    // Sort dates (earliest first)
    validDates.sort();
    
    const today = new Date().toISOString().split('T')[0];
    
    const dateChoices = [
      { name: `Today (${today})`, value: today },
      { name: 'All scheduled content', value: 'all' },
      ...validDates.map(date => ({ name: date, value: date }))
    ];
    
    // Prompt for date
    const { dateOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'dateOption',
        message: 'Select content to publish:',
        choices: dateChoices
      }
    ]);
    
    // Publish content
    if (dateOption === 'all') {
      await handlePublish({ all: true });
    } else {
      await handlePublish({ date: dateOption });
    }
  } catch (error) {
    console.error('Error publishing content:', error);
  }
}

// Helper function for interactive batch content creation
async function handleBatchContent() {
  try {
    // Prompt for batch file
    const { batchFile, schedule } = await inquirer.prompt([
      {
        type: 'input',
        name: 'batchFile',
        message: 'Enter path to batch file (CSV or JSON):',
        validate: input => {
          if (!input.trim()) return 'File path is required';
          if (!fs.existsSync(input)) return 'File does not exist';
          if (!input.endsWith('.csv') && !input.endsWith('.json')) return 'File must be CSV or JSON';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'schedule',
        message: 'Schedule content for future dates?',
        default: true
      }
    ]);
    
    // Process batch file
    await handleBatch(batchFile, { schedule });
  } catch (error) {
    console.error('Error processing batch content:', error);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
