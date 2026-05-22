const express = require('express');
const router = express.Router();
const Sermon = require('../models/Sermon'); // Using the Sermon model

// GET Gallery items (Images and Videos)
router.get('/gallery', async (req, res) => {
    try {
        // You could create a Media model or query your Sermons/Worship collections
        const media = await Sermon.find({ category: 'Worship' }).select('title videoUrl thumbnailUrl');
        res.json(media);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;