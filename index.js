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
  const credentials = Buffer.from(
    `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  // console.log("credentials", credentials);

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

    // console.log("response", response.data);

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
  try {
    const accessToken = await getZoomAccessToken();

    if (!accessToken) {
      return res.status(500).json({ error: "Failed to get Zoom access token" });
    }

    const webinarData = req.body;

    // Validate required fields
    if (!webinarData.topic) {
      return res.status(400).json({ error: "Webinar topic is required" });
    }

    if (!webinarData.start_time) {
      return res.status(400).json({ error: "Start time is required" });
    }

    // Basic webinar payload
    let webinarPayload = {
      topic: webinarData.topic,
      type: webinarData.type || 5, // Default to one-time webinar if not specified
      start_time: webinarData.start_time,
      duration: webinarData.duration || 60,
      timezone: webinarData.timezone || "Asia/Kolkata",
      settings: {
        host_video:
          webinarData.settings?.host_video !== undefined
            ? webinarData.settings.host_video
            : true,
        panelists_video:
          webinarData.settings?.panelists_video !== undefined
            ? webinarData.settings.panelists_video
            : true,
        practice_session:
          webinarData.settings?.practice_session !== undefined
            ? webinarData.settings.practice_session
            : true,
        registrants_email_notification:
          webinarData.settings?.registrants_email_notification !== undefined
            ? webinarData.settings.registrants_email_notification
            : true,
        approval_type:
          webinarData.settings?.approval_type !== undefined
            ? webinarData.settings.approval_type
            : 0,
        registration_type:
          webinarData.settings?.registration_type !== undefined
            ? webinarData.settings.registration_type
            : 1,
        meeting_authentication:
          webinarData.settings?.meeting_authentication !== undefined
            ? webinarData.settings.meeting_authentication
            : true,
        q_and_a:
          webinarData.settings?.q_and_a !== undefined
            ? webinarData.settings.q_and_a
            : true,
        enable_chat:
          webinarData.settings?.enable_chat !== undefined
            ? webinarData.settings.enable_chat
            : true,
        allow_multiple_devices:
          webinarData.settings?.allow_multiple_devices !== undefined
            ? webinarData.settings.allow_multiple_devices
            : false,
        auto_recording: webinarData.settings?.auto_recording || "none",
        meeting_authentication: true,
        // Require registration
        registration_required: true,
        on_demand:
          webinarData.settings?.on_demand !== undefined
            ? webinarData.settings.on_demand
            : false,
      },
    };

    // Add alternative hosts if provided
    if (webinarData.co_hosts) {
      webinarPayload.settings.alternative_hosts = webinarData.co_hosts;
    }

    if (webinarData.type === 9) {
      // Validate recurrence data
      if (!webinarData.recurrence || !webinarData.recurrence.type) {
        return res.status(400).json({
          error:
            "Recurrence settings are required for recurring webinars (type 9)",
        });
      }

      if (!webinarData.recurrence.repeat_interval) {
        return res
          .status(400)
          .json({ error: "Repeat interval is required for recurrence" });
      }

      if (
        !webinarData.recurrence.end_times &&
        !webinarData.recurrence.end_date_time
      ) {
        return res.status(400).json({
          error: "Either end_times or end_date_time is required for recurrence",
        });
      }

      // Create base recurrence object
      const recurrence = {
        type: webinarData.recurrence.type,
        repeat_interval: webinarData.recurrence.repeat_interval,
      };

      // Add end condition (either end_times or end_date_time)
      if (webinarData.recurrence.end_times) {
        recurrence.end_times = webinarData.recurrence.end_times;
      } else if (webinarData.recurrence.end_date_time) {
        recurrence.end_date_time = webinarData.recurrence.end_date_time;
      }

      // Add type-specific recurrence settings
      switch (webinarData.recurrence.type) {
        case 1: // Daily
          // No additional fields needed
          break;

        case 2: // Weekly
          if (!webinarData.recurrence.weekly_days) {
            return res.status(400).json({
              error: "weekly_days is required for weekly recurrence",
            });
          }
          recurrence.weekly_days = webinarData.recurrence.weekly_days;
          break;

        case 3: // Monthly
          // Check if monthly_day OR (monthly_week AND monthly_week_day) is provided
          if (webinarData.recurrence.monthly_day) {
            recurrence.monthly_day = webinarData.recurrence.monthly_day;
          } else if (
            webinarData.recurrence.monthly_week &&
            webinarData.recurrence.monthly_week_day
          ) {
            recurrence.monthly_week = webinarData.recurrence.monthly_week;
            recurrence.monthly_week_day =
              webinarData.recurrence.monthly_week_day;
          } else {
            return res.status(400).json({
              error:
                "Either monthly_day OR (monthly_week AND monthly_week_day) is required for monthly recurrence",
            });
          }
          break;

        default:
          return res.status(400).json({
            error:
              "Invalid recurrence type. Must be 1 (daily), 2 (weekly), or 3 (monthly)",
          });
      }

      // Add recurrence to webinar payload
      webinarPayload.recurrence = recurrence;
    }

    // console.log("webinarPayload", webinarPayload);
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
      success: true,
      webinarId: webinarResponse.data.id,
      joinUrl: webinarResponse.data.join_url,
      startUrl: webinarResponse.data.start_url,
      data: webinarResponse.data,
    });
  } catch (error) {
    if (error.response && error.response.data) {
      const zoomError = error.response.data;
      console.error("Error creating Zoom webinar:", zoomError);
      
      return res.status(error.response.status || 500).json({ 
        error: `Zoom API Error: ${zoomError.message || 'Unknown error'}`,
        code: zoomError.code,
        details: zoomError
      });
    }
    
    // Handle other errors
    console.error("Error creating Zoom webinar:", error.message);
    return res.status(500).json({ 
      error: "Failed to create Zoom webinar", 
      details: error.message 
    });
  }
});

// API to Create a Zoom Webinar Registrant
app.post("/:webinarId/registrants", async (req, res) => {
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
    console.error(
      `Error creating registrant for webinar: ${webinarId}`,
      err.response ? err.response.data : err.message
    );
    return res
      .status(500)
      .json({ error: `Error creating registrant for webinar: ${webinarId}` });
  }
});

// API to Get Zoom Webinar Registrants
app.get("/:webinarId/registrants", async (req, res) => {
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
    status: status || "", // Include status if provided
    next_page_token: next_page_token || "", // Include next_page_token if provided
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
    console.error(
      `Error fetching registrants for webinar: ${webinarId}`,
      err.response ? err.response.data : err.message
    );
    return res
      .status(500)
      .json({ error: `Error fetching registrants for webinar: ${webinarId}` });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
