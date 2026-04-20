const fs = require('fs');
const path = require('path');

const seedFile = path.join(__dirname, '../scripts/seed.js');
let c = fs.readFileSync(seedFile, 'utf8');

// Add image field to each inventory item based on category
const replacements = [
	{ find: "category: \"Analgesic\"",      img: "https://images.unsplash.com/photo-1550572017-ed20015dd085?w=400" },
	{ find: "category: \"Antibiotics\"",    img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400" },
	{ find: "category: \"Antihistamine\"",  img: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400" },
	{ find: "category: \"Cardiovascular\"", img: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400" },
	{ find: "category: \"Cholesterol\"",    img: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=400" },
	{ find: "category: \"Diabetes\"",       img: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400" },
	{ find: "category: \"Gastric\"",        img: "https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?w=400" },
	{ find: "category: \"Vitamins\"",       img: "https://images.unsplash.com/photo-1471864190281-ad5f9f07ce4a?w=400" },
];

replacements.forEach(({ find, img }) => {
	// Replace each occurrence: add image after category if not already present
	c = c.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `${find}, image: "${img}"`);
});

// Remove duplicate image fields if script is run twice
c = c.replace(/, image: "[^"]*", image: "[^"]*"/g, (m) => m.split(', image:')[0] + ', image:' + m.split(', image:')[1]);

fs.writeFileSync(seedFile, c, 'utf8');
console.log('Seed file updated with image URLs.');
