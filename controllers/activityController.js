const { Invoice } = require("../model/Invoice");
const Activity = require("../model/Activity");

// Get recent activities based on invoice actions
exports.getRecentActivities = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch activities from Activity table
        const activities = await Activity.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit: 20,
            attributes: ['id', 'type', 'text', 'invoiceId', 'metadata', 'createdAt'],
        });


        // Format activities for frontend
        const formattedActivities = activities.map(activity => ({
            type: activity.type,
            text: activity.text,
            date: activity.createdAt,
            invoiceId: activity.invoiceId,
            metadata: activity.metadata,
        }));

        res.status(200).json(formattedActivities);

    } catch (error) {
        console.error("Error fetching recent activities:", error);
        res.status(500).json({ message: "Failed to fetch recent activities", error: error.message });
    }
};
