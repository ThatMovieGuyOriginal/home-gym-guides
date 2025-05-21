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
