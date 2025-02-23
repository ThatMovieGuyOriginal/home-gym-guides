---
layout: page
title: "About"
permalink: "/about/"
image: assets/images/screenshot.png
---

<!-- Inline CSS for demonstration; ideally place this in a dedicated stylesheet -->
<style>
  :root {
    --background-color: #F9F9F9;
    --primary-text: #333333;
    --cta-green: #28A745;
    --cta-green-dark: #218838;
    --secondary-accent: #FFC107;
    --white: #fff;
    --border-radius: 5px;
    --font-body: 'Roboto', 'Open Sans', sans-serif;
    --font-heading: 'Playfair Display', serif;
  }

  /* Global resets */
  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: var(--background-color);
    color: var(--primary-text);
    font-family: var(--font-body);
    line-height: 1.6;
  }

  /* Heading styling using Playfair Display */
  h1, h2 {
    font-family: var(--font-heading);
    color: var(--primary-text);
  }

  /* About container styling */
  .about-container {
    max-width: 700px;
    margin: 2rem auto;
    background-color: var(--white);
    border-radius: var(--border-radius);
    padding: 2rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .about-container h1 {
    text-align: center;
    margin-bottom: 1rem;
  }

  .about-container p {
    text-align: center;
    margin: 0.5rem 0;
  }

  .about-container h2 {
    margin-top: 2rem;
    text-align: center;
  }

  /* Accessible CTA link styling */
  .homepage-link {
    font-weight: bold;
    color: var(--cta-green);
    text-decoration: underline;
    text-decoration-color: var(--secondary-accent);
    text-decoration-thickness: 2px;
    transition: background-color 0.3s, color 0.3s;
  }
  .homepage-link:hover,
  .homepage-link:focus {
    background-color: var(--secondary-accent);
    color: var(--cta-green-dark);
    outline: none;
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .about-container {
      padding: 1rem;
      margin: 1rem;
    }
  }
</style>

<main role="main">
  <article class="about-container">
    <h1>Welcome to Home Gym Guides</h1>

    <p>
      At <strong>Home Gym Guides</strong>, we believe in empowering you to achieve your fitness goals from the comfort of your own space. Whether you’re a busy professional, a fitness newbie, or a seasoned athlete, our mission is to help you transform any area into a personal workout haven.
    </p>

    <p>
      From <strong>in-depth product reviews</strong> to expert tips on training and motivation, our goal is to make setting up a home gym easy, accessible, and fun. We’re proud to share insights, honest recommendations, and real-life results that will keep you inspired and confident in your fitness journey.
    </p>

    <h2>Why Trust Us?</h2>
    <p>
      We’re a community of fitness enthusiasts who have tested countless products and workout strategies. Our content is backed by thorough research, user feedback, and a genuine passion for health and wellness. We want to save you time, money, and frustration by steering you toward the best equipment and advice for your unique needs.
    </p>

    <p>
      <em>Trusted by thousands of readers and fitness lovers</em>, our approach is built on honesty, integrity, and a desire to see you succeed.
    </p>

    <h2>Ready to Take the Next Step?</h2>
    <p>
      Check out our 
      <a href="{{ site.baseurl }}/recommended-gear" class="homepage-link">Recommended Gear</a> 
      for expert product picks, or head back to our 
      <a href="{{ site.baseurl }}/" class="homepage-link">Homepage</a> 
      for more articles, tips, and reviews.
    </p>
  </article>
</main>
