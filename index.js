require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

// Function to get Zoom Access Token
async function getZoomAccessToken() {

  const tokenUrl = "https://zoom.us/oauth/token";
  const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

  console.log("credentials", credentials);

  try {
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: "account_credentials",
        account_id: ZOOM_ACCOUNT_ID,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("response", response.data);

    return response.data.access_token;

  } catch (error) {
    console.error(
      "Error fetching Zoom token:",
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

// API to Create a Zoom Meeting
app.post("/create-meeting", async (req, res) => {
  const accessToken = await getZoomAccessToken();
  if (!accessToken) {
    return res.status(500).json({ error: "Failed to get Zoom access token" });
  }

  try {
    const zoomResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: "Test Meeting",
        type: 2,
        start_time: new Date().toISOString(),
        duration: 60,
        timezone: "Asia/Kolkata",
        password: "123456",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      meetingId: zoomResponse.data.id,
      joinUrl: zoomResponse.data.join_url,
      startUrl: zoomResponse.data.start_url,
    });
  } catch (error) {
    console.error(
      "Error creating Zoom meeting:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to create Zoom meeting" });
  }
});

// API to Create a Zoom Webinar
app.post("/create-webinar", async (req, res) => {
  const accessToken = await getZoomAccessToken();
  if (!accessToken) {
    return res.status(500).json({ error: "Failed to get Zoom access token" });
  }

  const webinarData = req.body;
  console.log('webinarData', webinarData)
  const webinarPayload = {
    topic: webinarData.topic || "Test Webinar for webinar system management web app",
    type: webinarData.type || 5, // Default: Scheduled Recurring Webinar
    start_time: webinarData.start_time || "2026-01-01T10:00:00Z", // Example: January 1, 2026, at 10:00 AM UTC
    duration: webinarData.duration || 60, // Default 60 mins
    timezone: webinarData.timezone || "Asia/Kolkata",
    recurrence: {
    type: webinarData.recurrence.type,           
    repeat_interval: webinarData.recurrence.repeat_interval, 
    end_times: webinarData.recurrence.end_times
    },
    settings: {
      host_video: true,
      panelists_video: true,
      practice_session: true,
      registrants_email_notification: true,
      approval_type: 0, // Auto-approve registrants
      registration_type: 1, // Register once for all sessions
      meeting_authentication: true,
      alternative_hosts: webinarData.co_hosts || "",
      q_and_a: true,
      enable_chat: true,
      allow_multiple_devices: false,
      auto_recording: "none", // Enable automatic cloud recording
      on_demand: false,
    },
  };

  try {
    const webinarResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/webinars",
      webinarPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      webinarId: webinarResponse.data.id,
      joinUrl: webinarResponse.data.join_url,
      startUrl: webinarResponse.data.start_url,
      data: webinarResponse.data,
    });
  } catch (error) {
    console.error(
      "Error creating Zoom webinar:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to create Zoom webinar" });
  }
});

// API to Create a Zoom Webinar Registrant
app.post('/:webinarId/registrants', async (req, res) => {
  const { params, body } = req;
  const { webinarId } = params;

  // Get the access token
  const accessToken = await getZoomAccessToken();
  if (!accessToken) {
    return res.status(500).json({ error: "Failed to get Zoom access token" });
  }

  // Prepare the request to create a registrant
  const registrantPayload = {
    email: body.email, 
    first_name: body.first_name, 
    last_name: body.last_name, 
  };

  try {
    const request = await axios.post(
      `https://api.zoom.us/v2/webinars/${webinarId}/registrants`,
      registrantPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.json(request.data);
  } catch (err) {
    console.error(`Error creating registrant for webinar: ${webinarId}`, err.response ? err.response.data : err.message);
    return res.status(500).json({ error: `Error creating registrant for webinar: ${webinarId}` });
  }
});

// API to Get Zoom Webinar Registrants
app.get('/:webinarId/registrants', async (req, res) => {
  const { params, query } = req;
  const { webinarId } = params;
  const { status, next_page_token } = query;

  // Get the access token
  const accessToken = await getZoomAccessToken();
  if (!accessToken) {
    return res.status(500).json({ error: "Failed to get Zoom access token" });
  }

  // Construct the query string manually
  const queryString = new URLSearchParams({
    status: status || '', // Include status if provided
    next_page_token: next_page_token || '' // Include next_page_token if provided
  }).toString();

  try {
    const request = await axios.get(
      `https://api.zoom.us/v2/webinars/${webinarId}/registrants?${queryString}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.json(request.data);
  } catch (err) {
    console.error(`Error fetching registrants for webinar: ${webinarId}`, err.response ? err.response.data : err.message);
    return res.status(500).json({ error: `Error fetching registrants for webinar: ${webinarId}` });
  }
});



// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
