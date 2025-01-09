const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const app = express();
const port = 3000;

// Add middleware to parse JSON requests
app.use(express.json());

// Function to scrape product data
async function scrapeProducts(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const allItems = await page.evaluate(() => {
        const carouselDiv = document.querySelector('.carousel_items'); // Get the main div
        if (!carouselDiv) {
            return null; // Return null if the div is not found
        }

        const itemsfound = [...carouselDiv.querySelectorAll('.carousel_item')].map(item => ({
            html: item.innerHTML, // Get inner HTML of each carousel item
            text: item.innerText  // Get text content
        }));

        return {
            carouselHTML: carouselDiv.outerHTML, // The full HTML of the carousel_items div
            itemsfound // The extracted carousel items
        };
    });

    await browser.close();
    return allItems;
}

// API endpoint to scrape and process data
app.post('/scrape', async (req, res) => {
    try {
        const { targetUrl } = req.body;

        if (!targetUrl) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const scrapedData = await scrapeProducts(targetUrl);

        if (!scrapedData || !scrapedData.itemsfound) {
            return res.status(404).json({ error: 'carousel_items not found on the page' });
        }

        // Process each item in itemsfound to extract specific details
        const processedItems = scrapedData.itemsfound.map((item) => {
            const $ = cheerio.load(item.html); // Load the HTML using cheerio

            // Extract item-price
            const itemPrice = $('[data-flow-localize="item-price"]').text().trim() || null;

            // Extract heading
            const heading = $('.product__name span[role="heading"]').text().trim() || null;

            // Extract image
            const image = $('product-picture img').attr('src') || null;

            return { price: itemPrice, heading, image };
        });

        res.json(processedItems); // Return processed data
    } catch (error) {
        console.error('Error in /scrape endpoint:', error);
        res.status(500).json({ error: 'Failed to scrape products' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
