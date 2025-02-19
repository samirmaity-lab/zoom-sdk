require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

// Function to get Zoom Access Token
async function getZoomAccessToken() {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post(tokenUrl, 
            new URLSearchParams({
                grant_type: 'account_credentials',
                account_id: ZOOM_ACCOUNT_ID
            }), {
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching Zoom token:', error.response ? error.response.data : error.message);
        return null;
    }
}

// API to Create a Zoom Meeting
app.post('/create-meeting', async (req, res) => {
    const accessToken = await getZoomAccessToken();
    if (!accessToken) {
        return res.status(500).json({ error: 'Failed to get Zoom access token' });
    }

    try {
        const zoomResponse = await axios.post(
            'https://api.zoom.us/v2/users/me/meetings',
            {
                topic: 'Test Meeting',
                type: 2,
                start_time: new Date().toISOString(),
                duration: 60,
                timezone: 'Asia/Kolkata',
                password: '123456',
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: false,
                    mute_upon_entry: true
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        res.json({
            meetingId: zoomResponse.data.id,
            joinUrl: zoomResponse.data.join_url,
            startUrl: zoomResponse.data.start_url
        });

    } catch (error) {
        console.error('Error creating Zoom meeting:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to create Zoom meeting' });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
