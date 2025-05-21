#!/usr/bin/env node

/**
 * Content Generator for Home Gym Guides
 * 
 * This script automates the creation of new content based on templates.
 * It can generate blog posts, product reviews, and equipment pages.
 * 
 * Usage: node generate-content.js [type] [title]
 * Examples:
 *   node generate-content.js post "10 Essential Exercises for Home Workouts"
 *   node generate-content.js review "Bowflex SelectTech 552 Adjustable Dumbbells"
 *   node generate-content.js equipment "Resistance Bands"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');
const { execSync } = require('child_process');

// Define OpenAI API parameters
const OAI_ENDPOINT = process.env.OAI_ENDPOINT || 'https://api.openai.com/v1/completions';
const OAI_API_KEY = process.env.OAI_API_KEY;

// Promisify fs functions
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Define content types and templates
const contentTypes = {
  post: {
    template: '_templates/post-template.md',
    outputDir: '_posts',
    datePrefix: true
  },
  review: {
    template: '_templates/review-template.md',
    outputDir: '_posts',
    datePrefix: true
  },
  equipment: {
    template: '_templates/equipment-template.md',
    outputDir: '_equipment',
    datePrefix: false
  },
  category: {
    template: '_templates/category-template.md',
    outputDir: '_category',
    datePrefix: false
  }
};

// Main function
async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const contentType = args[0] || await promptQuestion('What type of content do you want to create? (post/review/equipment/category): ');
    
    // Validate content type
    if (!contentTypes[contentType]) {
      console.error(`Error: Invalid content type "${contentType}". Valid types are: ${Object.keys(contentTypes).join(', ')}`);
      process.exit(1);
    }
    
    // Get title
    const title = args[1] || await promptQuestion('Enter the title: ');
    
    // Get additional metadata
    let metadata = {};
    
    // Different prompts based on content type
    if (contentType === 'post' || contentType === 'review') {
      metadata.categories = await promptQuestion('Enter categories (comma-separated): ');
      metadata.tags = await promptQuestion('Enter tags (comma-separated): ');
      metadata.author = await promptQuestion('Enter author ID: ');
      metadata.featured = await promptQuestion('Is this a featured post? (true/false): ') === 'true';
    } else if (contentType === 'equipment') {
      metadata.category = await promptQuestion('Enter main category (e.g., strength-training, cardio-equipment): ');
      metadata.subcategory = await promptQuestion('Enter subcategory (e.g., dumbbells, treadmills): ');
      metadata.featured = await promptQuestion('Is this a featured equipment? (true/false): ') === 'true';
    } else if (contentType === 'category') {
      metadata.description = await promptQuestion('Enter category description: ');
      metadata.permalink = await promptQuestion('Enter permalink (e.g., /category/cardio-equipment/): ');
    }
    
    // Get content generation method
    const generationMethod = await promptQuestion('Generate content with AI? (yes/no): ');
    
    // Generate content with AI if requested
    let generatedContent = '';
    if (generationMethod.toLowerCase() === 'yes') {
      if (!OAI_API_KEY) {
        console.log('OpenAI API key not found in environment variables. Please set OAI_API_KEY.');
        const apiKey = await promptQuestion('Enter OpenAI API key for this session: ');
        process.env.OAI_API_KEY = apiKey;
      }
      
      console.log('Generating content with AI...');
      generatedContent = await generateAIContent(contentType, title, metadata);
    }
    
    // Create the content file
    await createContentFile(contentType, title, metadata, generatedContent);
    
    console.log(`\nContent created successfully! 🎉`);
    rl.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Prompt for user input
function promptQuestion(question) {
  return new Promise(resolve => {
    rl.question(`${question} `, answer => {
      resolve(answer.trim());
    });
  });
}

// Generate content with OpenAI API
async function generateAIContent(contentType, title, metadata) {
  try {
    // Check if OpenAI API is configured
    if (!process.env.OAI_API_KEY) {
      console.log('OpenAI API key not found. Skipping AI content generation.');
      return '';
    }
    
    // Create prompt based on content type
    let prompt = '';
    
    if (contentType === 'post') {
      prompt = `Write a comprehensive blog post titled "${title}" for a fitness website focused on home gym equipment. 
      The blog post should discuss: 
      1. An introduction to the topic
      2. The main points related to ${title}
      3. Practical tips and advice for home gym enthusiasts
      4. A conclusion with actionable steps
      
      Categories: ${metadata.categories}
      Tags: ${metadata.tags}
      
      Format the content in markdown, including appropriate headers, lists, and emphasis where needed. Keep the tone informative yet conversational.`;
    } else if (contentType === 'review') {
      prompt = `Write a detailed product review for "${title}" for a home gym equipment review website.
      The review should include:
      1. Overview and first impressions
      2. Key features and specifications
      3. Build quality and durability
      4. User experience and performance
      5. Value for money
      6. Pros and cons
      7. Verdict and rating
      
      Categories: ${metadata.categories}
      Tags: ${metadata.tags}
      
      Format the content in markdown with appropriate headers, bullet points, and emphasis. Include placeholder text for affiliate links where appropriate. The review should be honest, highlighting both strengths and weaknesses.`;
    } else if (contentType === 'equipment') {
      prompt = `Create a comprehensive guide about ${title} for a home gym equipment website.
      The guide should include:
      1. What are ${title} and their purpose
      2. Benefits of using ${title}
      3. Types of ${title} available
      4. How to choose the right ${title} for a home gym
      5. Top features to look for
      6. Price ranges and what to expect at different budget levels
      7. Maintenance and care tips
      
      Category: ${metadata.category}
      Subcategory: ${metadata.subcategory}
      
      Format the content in markdown with appropriate headers and sections. Focus on providing valuable information for home gym enthusiasts considering purchasing ${title}.`;
    } else if (contentType === 'category') {
      prompt = `Write a detailed category description for ${title} for a home gym equipment website.
      The description should:
      1. Explain what ${title} are and their role in a home gym
      2. Discuss the main types or subcategories of ${title}
      3. Highlight key benefits of having ${title} in a home gym
      4. Mention important considerations when choosing ${title}
      
      Keep the content informative and helpful for readers looking to understand more about ${title} for their home gym setup.`;
    }
    
    // Make API call to OpenAI
    const openaiModule = await import('openai');
    const { OpenAI } = openaiModule.default || openaiModule;
    
    const openai = new OpenAI({
      apiKey: process.env.OAI_API_KEY
    });
    
    console.log('Sending request to OpenAI...');
    
    const completion = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct", // Use appropriate model
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.7,
    });
    
    return completion.choices[0].text.trim();
  } catch (error) {
    console.error('Error generating content with OpenAI:', error);
    console.log('Continuing with empty content...');
    return '';
  }
}

// Create content file based on template
async function createContentFile(contentType, title, metadata, generatedContent) {
  try {
    const { template, outputDir, datePrefix } = contentTypes[contentType];
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }
    
    // Read template
    const templateContent = await readFile(template, 'utf8');
    
    // Generate filename
    const slug = title.toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
    
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const filename = datePrefix 
      ? `${outputDir}/${date}-${slug}.md`
      : `${outputDir}/${slug}.md`;
    
    // Replace template placeholders
    let content = templateContent
      .replace(/{{title}}/g, title)
      .replace(/{{date}}/g, date)
      .replace(/{{slug}}/g, slug);
    
    // Replace metadata placeholders
    for (const [key, value] of Object.entries(metadata)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    
    // Add generated content
    if (generatedContent) {
      content = content.replace('{{content}}', generatedContent);
    }
    
    // Write to file
    await writeFile(filename, content, 'utf8');
    console.log(`Created: ${filename}`);
    
    // Open file in editor if available
    try {
      const editor = process.env.EDITOR || 'code'; // Default to VS Code
      execSync(`${editor} "${filename}"`, { stdio: 'inherit' });
    } catch (error) {
      console.log(`File created but could not open in editor: ${error.message}`);
    }
    
    return filename;
  } catch (error) {
    console.error('Error creating content file:', error);
    throw error;
  }
}

// Run the main function
main().catch(console.error);
