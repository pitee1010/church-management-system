// Example of a backend function to save a new sermon
const uploadSermon = async (req, res) => {
    // Check if user is admin (using your existing RBAC logic)
    if (req.user.role !== 'admin') {
        return res.status(403).send("Unauthorized");
    }

    const { title, videoUrl, category } = req.body;
    // Logic to save to database goes here...
    console.log(`Sermon "${title}" added to the system.`);
};