---
layout: page
title: About
permalink: "/about/"
image: assets/images/screenshot.png
---

<!-- Inline CSS for demonstration; ideally place this in a dedicated stylesheet -->
<style>
  /* Branded light neutral background and primary text color */
  body {
    background-color: #F9F9F9;
    color: #333333;
    font-family: 'Roboto', 'Open Sans', sans-serif;
  }

  /* Headings styled with Playfair Display for authority and elegance */
  h1, h2 {
    font-family: 'Playfair Display', serif;
    color: #333333;
  }

  /* About container styling with a clean white background and subtle shadow */
  .about-container {
    max-width: 700px;
    margin: 0 auto;
    background-color: #fff;
    border-radius: 5px;
    padding: 2rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  /* Centered heading and paragraph alignment */
  .about-container h1 {
    text-align: center;
    margin-bottom: 1rem;
  }
  .about-container p {
    text-align: center;
  }

  /* CTA link styling using our CTA color and secondary accent for hover */
  .homepage-link {
    font-weight: bold;
    color: #28A745;
    text-decoration: underline;
    text-decoration-color: #FFC107;
    text-decoration-thickness: 2px;
    transition: background-color 0.3s, color 0.3s;
  }
  .homepage-link:hover {
    background-color: #FFC107;
    color: #218838;
  }

  /* Additional styling for subheadings */
  .about-container h2 {
    margin-top: 2rem;
    text-align: center;
  }
</style>

<div class="about-container">
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
</div>
