---
layout: page
title: "Privacy Policy"
permalink: /privacy-policy/
comments: false
---

<!-- Inline CSS for demonstration; ideally place this in a dedicated stylesheet -->
<style>
  /* CSS Variables for consistent theming */
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

  /* Global resets for consistency */
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

  /* Responsive and accessible heading styles */
  h1, h2, h3 {
    font-family: var(--font-heading);
    color: var(--primary-text);
    text-align: center;
    margin-bottom: 1rem;
  }

  /* Container styling for the privacy policy content */
  .privacy-container {
    max-width: 700px;
    margin: 2rem auto;
    background-color: var(--white);
    border-radius: var(--border-radius);
    padding: 2rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .privacy-container p,
  .privacy-container li {
    text-align: left;
  }

  /* Accessible and branded link styling */
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
    .privacy-container {
      padding: 1rem;
      margin: 1rem;
    }
  }
</style>

<main role="main">
  <article class="privacy-container">
    <p>
      At <strong>Home Gym Guides</strong>, we respect your privacy and are committed to protecting any personal information you share with us. This policy outlines how we handle the data we collect and how it’s used.
    </p>

    <h2>Information Gathered from Visitors</h2>
    <p>
      In common with other websites, our server stores log files containing details such as your IP address, browser type, referring page, and the time of your visit. These logs help us diagnose technical issues and understand user behavior to improve our site’s performance.
    </p>
    <p>
      We may also collect email addresses if you voluntarily subscribe to our newsletter or provide them via contact forms. This allows us to send updates, offers, or other marketing-related information relevant to your fitness journey.
    </p>

    <h2>Cookies</h2>
    <p>
      Cookies are small digital signature files stored by your web browser. They help remember your preferences, track return visits, and enhance your overall experience. Third-party advertising companies may also use cookies for tracking purposes.
    </p>
    <p>
      You can typically block or disable cookies via your browser settings; however, this may affect certain site features.
    </p>

    <h2>How the Information Is Used</h2>
    <ul>
      <li><strong>Enhancing User Experience:</strong> We use logs and cookies to personalize content and possibly display relevant advertising.</li>
      <li><strong>Email Communications:</strong> We send emails to subscribers with news, fitness insights, or product recommendations. You can unsubscribe at any time by following the link in the email.</li>
      <li><strong>No Sale or Lease of Emails:</strong> We do not sell, rent, or lease your email address to third parties. Ever.</li>
    </ul>

    <h2>Visitor Options</h2>
    <p>
      If you have subscribed to one of our services (e.g., a newsletter), you may unsubscribe by following the instructions in the emails you receive.
    </p>
    <p>
      If you have concerns about cookies, you can modify your browser settings to block or delete them, though some site features may be unavailable.
    </p>

    <h2>Google Ads</h2>
    <p>
      Google, as a third-party vendor, uses cookies to serve ads on our site. The DART cookie enables Google to serve ads to visitors based on their browsing history across the Internet. You may opt out of the DART cookie by visiting the <a href="https://policies.google.com/technologies/ads" class="homepage-link" target="_blank" rel="noopener noreferrer">Google ad and content network privacy policy</a>.
    </p>

    <h2>Contact Us</h2>
    <p>
      If you have any questions or concerns regarding our privacy practices, please feel free to <a href="{{ site.baseurl }}/contact" class="homepage-link">Contact Us</a> at any time.
    </p>
  </article>
</main>
