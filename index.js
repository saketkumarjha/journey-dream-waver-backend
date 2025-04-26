// server.js - Express server file for Gemini API integration
const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
const cors = require("cors");
// const generalChat = require("./controller/generalChat");
// const streamingContent = require("./controller/streamingContent");
// const travelSuggestions = require("./controller/travelSuggestions");
// const photoCaption = require("./controller/photoCaption");
// const healthAndSafety = require("./controller/healthAndSafety");
// const travelEmergencyContacts = require("./controller/travelEmergencyContacts");
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const initializeGeminiAPI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in environment variables");
    process.exit(1);
  }
  return new GoogleGenAI({ apiKey });
};

const geminiAPI = initializeGeminiAPI();

app.get('/', (req,res)=>{
  res.json({msg:"Hello"})
})

app.post("/api/generateContent", async (req, res) => {
  try {
    const { prompt, model = "gemini-2.0-flash" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await geminiAPI.models.generateContent({
      model,
      contents: prompt,
    });

    res.json({
      success: true,
      result: response.text,
    });
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate content",
      details: error.message,
    });
  }
});

app.post("/api/generateContentStream", async (req, res) => {
  try {
    const {
      model = "gemini-2.5-pro-preview-03-25",
      contents,
      responseMimeType = "text/plain",
    } = req.body;

    if (!contents) {
      return res.status(400).json({ error: "Contents are required" });
    }

    // Set response headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const config = {
      responseMimeType,
    };

    // Generate content stream
    const response = await geminiAPI.models.generateContentStream({
      model,
      config,
      contents,
    });

    // Stream the response chunks to the client
    for await (const chunk of response) {
      res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error streaming content:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post("/api/getTravelSuggestions", async (req, res) => {
  try {
    const { interests, location } = req.body;

    if (!interests || !location) {
      return res.status(400).json({
        success: false,
        error: "Both interests and location are required",
      });
    }

    const model = "gemini-2.5-pro-preview-03-25";
    const config = {
      responseMimeType: "text/plain",
    };

    // Format the conversation with the travel prompt template from your example
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Based on my interests: ${interests}, suggest 3 unique places to visit in ${location}.`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: `Here's a thinking process that leads to the suggested travel itineraries:
  
  1.  **Deconstruct the Request:**
      *   **Core Task:** Suggest 3 *unique* places to visit.
      *   **Input 1:** User's Interests (e.g., nature, adventure, food, history, art, relaxation, etc.). This is the *primary filter*.
      *   **Input 2:** A specific Continent or Country. This defines the *geographic scope*.
      *   **Output Requirement:** 3 distinct suggestions, each presented as a coherent place/experience. "Unique" implies going beyond the absolute most famous, obvious tourist traps, or offering a specific *angle* on a well-known place.
  
  2.  **Initial Brainstorming & Strategy:**
      *   I need placeholders for the user's interests and the location. Let's use \`[User Interests]\` and \`[Location]\`.
      *   The key is combining the interests with the location. I can't just list 3 random places in the location; they *must* align with the interests.
      *   "Unique" is subjective. My strategy will be:
          *   Avoid *only* suggesting the absolute #1 tourist spot (e.g., just Paris for France, just Tokyo for Japan).
          *   If suggesting a popular area, focus on a *specific* experience within it that aligns with the interests.
          *   Consider slightly less famous but still high-quality destinations within the location.
          *   Combine multiple interests into a single suggested place/experience where possible.
  
  3.  **Develop a Template Structure for Each Suggestion:**
      *   **Place Name:** Clear and identifiable.
      *   **Brief Description:** What is this place generally known for?
      *   **Why it fits [User Interests]:** Explicitly connect the place to the *specific* interests provided by the user. This is crucial for personalization. Use bullet points for clarity.
      *   **Unique Angle/Experience:** What makes this suggestion stand out? What specific activity or aspect should the user focus on?
      *   **(Optional but helpful):** A concluding sentence that reinforces the appeal.
  
  4.  **Pre-computation/Pre-analysis (Internal Knowledge):**
      *   My internal knowledge base contains information about countless places worldwide, categorized by features (mountains, beaches, cities, historical sites, etc.) and associated activities (hiking, diving, cooking classes, museum visits, etc.).
      *   I need to be able to map the user's stated interests (keywords like "nature," "adventure," "food") to these features and activities.
          *   \`Nature\` -> National Parks, mountains, forests, coastlines, wildlife viewing, hiking, kayaking.
          *   \`Adventure\` -> Hiking, climbing, rafting, diving, zip-lining, exploring remote areas, challenging activities.
          *   \`Food\` -> Local markets, cooking classes, specific regional cuisines, renowned restaurants, food tours, vineyards/breweries.
          *   \`History\` -> Ancient ruins, historical districts, museums, castles, battlefields.
          *   \`Art\` -> Museums, galleries, street art, architectural sites, artisan workshops.
          *   \`Relaxation\` -> Beaches, spas, quiet countryside, resorts, yoga retreats.
          *   \`Culture\` -> Local festivals, traditional villages, markets, temples/churches, interacting with locals.
  
  5.  **Execution - Step-by-Step Example (Let's simulate a request):**
      *   **User Input:** Interests: \`Nature\`, \`Adventure\`, \`Food\`. Location: \`Peru\`.
  
      *   **Step 1: Filter by Location (Peru):** Access knowledge about Peru. Key places: Machu Picchu, Cusco, Lima, Amazon Rainforest, Lake Titicaca, Arequipa, Colca Canyon, Huacachina, Nazca Lines, Northern Peru (Trujillo, Chiclayo).
  
      *   **Step 2: Filter by Interests (Nature, Adventure, Food):**
          *   *Nature:* Amazon, Colca Canyon, Andes (general), Lake Titicaca, Paracas National Reserve.
          *   *Adventure:* Inca Trail, Salkantay Trek, Colca Canyon trekking, sandboarding in Huacachina, rafting near Cusco, climbing in Huaraz (though maybe too specific if not mentioned).
          *   *Food:* Lima (world-renowned culinary scene), Cusco (Andean cuisine), Arequipa (regional specialties), jungle fruits/dishes (Amazon).
  
      *   **Step 3: Combine and Find Unique Angles (Generate 3 Suggestions):**
  
          *   **Idea 1 (Classic + Twist):** Machu Picchu is unavoidable, but how to make it fit *adventure* and *nature* uniquely? Focus on a *trek* instead of just the train/bus.
              *   *Place:* The Salkantay Trek to Machu Picchu.
              *   *Why it fits:* **Nature** (Andean landscapes, cloud forest), **Adventure** (multi-day challenging trek). **Food** (mention camp meals featuring local ingredients, or reward meals in Aguas Calientes/Cusco).
              *   *Unique Angle:* Less crowded than the Classic Inca Trail, arguably more diverse scenery. Focus on the *journey* as the adventure.
  
          *   **Idea 2 (Focus on Food + Nature/Adventure):** Lima is the food capital, but let's add nature/adventure nearby.
              *   *Place:* Lima & Paracas National Reserve.
              *   *Why it fits:* **Food** (Lima's world-class restaurants, ceviche, markets). **Nature** (Paracas: desert meets ocean, wildlife like sea lions, penguins, birds). **Adventure** (Boat tour to Ballestas Islands, dune buggying/sandboarding in nearby Huacachina - slight stretch geographically but often combined).
              *   *Unique Angle:* Contrasting the urban culinary scene with stark coastal desert nature and wildlife encounters.
  
          *   **Idea 3 (Deep Nature/Adventure + Local Food):** The Amazon is prime nature/adventure. How to frame it uniquely? Focus on a specific lodge/experience.
              *   *Place:* Tambopata National Reserve (Amazon Rainforest).
              *   *Why it fits:* **Nature** (Incredible biodiversity, jungle ecosystems). **Adventure** (Jungle treks, piranha fishing, canopy walks, night walks, kayaking). **Food** (Experiencing local jungle fruits, dishes prepared at the lodge, potentially learning about medicinal plants/local food sources).
              *   *Unique Angle:* Immersion in deep rainforest, focusing on wildlife spotting (macaw clay licks, giant otters) and staying in an eco-lodge. More immersive than a quick day trip.
  
      *   **Step 4: Refine and Format:** Write out the suggestions using the template, ensuring clear connections to the user's interests and highlighting the unique aspects. Add introductory and concluding remarks. Ensure the language is engaging.
  
  6.  **Final Review:**
      *   Are there exactly 3 suggestions? Yes.
      *   Are they within the specified location? Yes.
      *   Do they *clearly* connect to the user's interests? Yes.
      *   Are they reasonably "unique" (not just the top 3 most obvious Google results, or offering a specific angle)? Yes.
      *   Is the formatting clear and easy to read? Yes.
      *   Is the tone helpful and encouraging? Yes.
  
  This structured thinking process allows for personalization based on interests and location while aiming for suggestions that offer something beyond the most generic tourist itinerary.`,
          },
          {
            text: `Okay, let's get some unique travel ideas brewing!
  
  Please tell me:
  
  1.  **Your Interests:** (e.g., nature, adventure, food, history, art, relaxation, culture, wildlife, hiking, cities, off-the-beaten-path, etc.)
  2.  **The Continent or Country:** Where in the world are you thinking of?
  
  Once I have this information, I can suggest 3 unique places tailored to you!
  
  **Example Request:**
  
  *   **Interests:** Nature, Hiking, Photography, Culture
  *   **Location:** Japan
  
  **Looking forward to hearing your choices!**`,
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: `Interests: ${interests}
  Location: ${location}`,
          },
        ],
      },
    ];

    // For non-streaming response
    const response = await geminiAPI.models.generateContent({
      model,
      contents,
    });

    res.json({
      success: true,
      suggestions: response.text,
    });
  } catch (error) {
    console.error("Error generating travel suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate travel suggestions",
      details: error.message,
    });
  }
});

app.post("/api/generatePhotoCaption", async (req, res) => {
  try {
    const { photoBase64, captionStyle = "funny", description = "" } = req.body;

    if (!photoBase64) {
      return res.status(400).json({
        success: false,
        error: "Photo is required (in base64 format)",
      });
    }

    // Validate caption style
    const validStyles = [
      "funny",
      "poetic",
      "dramatic",
      "simple",
      "creative",
      "romantic",
      "patriotic",
      "adventurous",
    ];
    const style = validStyles.includes(captionStyle) ? captionStyle : "funny";

    // Format the contents with the photo and style request
    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: photoBase64,
              mimeType: "image/jpeg", // Adjust based on actual image type
            },
          },
          {
            text: `Create a ${style} caption for this photo I took${
              description ? ": " + description : ""
            }. The caption should be appropriate for social media and capture the essence of the image. Please provide 3 different caption options.`,
          },
        ],
      },
    ];

    // Use the models.generateContent method directly
    const response = await geminiAPI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents,
      generationConfig: {
        responseMimeType: "text/plain",
      },
    });

    // Extract the caption text
    const captionText = response.response?.text() || response.text;

    // Return the captions
    res.json({
      success: true,
      captions: captionText,
      style: style,
    });
  } catch (error) {
    console.error("Error generating photo caption:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate photo caption",
      details: error.message,
    });
  }
});

app.post("/api/getTravelSafetyGuide", async (req, res) => {
  try {
    const { destination } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        error: "Destination is required",
      });
    }

    // Create the model prompt
    const model = "gemini-2.5-flash-preview-04-17";
    const config = {
      responseMimeType: "text/plain",
    };

    // Format the contents with the template from the example
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Give a brief health and safety travel guide for a tourist visiting ${destination}. Include common vaccinations, food/water safety, and health tips.`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: `Here's a thinking process that leads to the travel health and safety guide:
    
    1.  **Understand the Goal:** The user wants a *brief* health and safety travel guide for a *specific* city/country. It needs to cover vaccinations, food/water safety, and general health tips. The key is *brief* and adaptable to a specific location (indicated by \`[City/Country]\`).
    
    2.  **Identify the Core Components:** The request explicitly lists:
        *   Brief
        *   Health and Safety
        *   Travel Guide
        *   Common Vaccinations
        *   Food/Water Safety
        *   Health Tips
        *   For a tourist visiting \`[City/Country]\`
    
    3.  **Structure the Guide:** A logical structure would be:
        *   Introduction (Welcome, general safety reminder)
        *   Before You Go (Planning, vaccinations, insurance)
        *   During Your Trip (Food/water, general health, safety)
        *   Emergency Information (What to do if something happens)
        *   Disclaimer (Importance of professional advice)
    
    4.  **Flesh out each section (General Template):**
    
        *   **Introduction:** State the purpose – helping tourists stay healthy and safe in \`[City/Country]\`. Mention \`[City/Country]\` is a wonderful place, but like any destination, precautions are necessary.
        *   **Before You Go:**
            *   **Consult a Doctor:** Emphasize seeing a healthcare provider *before* traveling (specify a timeframe, e.g., 4-6 weeks). This is crucial for personalized advice.
            *   **Vaccinations:** This is a core requirement.
                *   Mention *routine* vaccinations (Measles, Mumps, Rubella (MMR), Diphtheria, Tetanus, Pertussis, Polio, Flu). These are important *wherever* you travel.
                *   Mention *potential* recommended vaccinations specific to \`[City/Country]\`. *Crucially, I cannot know these for a generic \`[City/Country]\`*. I need placeholder text here. List common *types* of destination-specific vaccines and advise checking official sources/doctor. Examples: Hepatitis A, Typhoid, Yellow Fever (if required/risk), Rabies, Japanese Encephalitis, Malaria (if relevant, requires medication, not just vaccine).
            *   **Travel Insurance:** Absolutely essential. Cover medical emergencies and travel disruptions.
            *   **Prescriptions/Medications:** Bring enough, keep them in original packaging, maybe a doctor's note.
        *   **During Your Trip:**
            *   **Food and Water Safety:** This is another core requirement.
                *   General principle: "Boil it, cook it, peel it, or forget it."
                *   Water: Bottled water is safest. Avoid tap water, ice made from tap water. Hot beverages usually okay. Water filters/purifiers might be an option.
                *   Food: Eat hot, well-cooked food. Avoid raw or undercooked meat/fish/eggs. Be wary of street food (look for high turnover, freshly prepared). Peel fruits yourself. Wash hands frequently.
            *   **General Health Tips:**
                *   Sun Protection: Sunscreen, hats, sunglasses (especially if \`[City/Country]\` is sunny).
                *   Insect Bites: Repellent (DEET or picaridin), cover up (especially at dawn/dusk). Mention potential diseases (Malaria, Dengue, Zika - *mention these are location-dependent*).
                *   Hygiene: Frequent hand washing (soap and water or hand sanitizer).
                *   Stay Hydrated: Drink plenty of safe water.
                *   Manage Chronic Conditions: Continue taking regular medications.
            *   **General Safety Tips:**
                *   Awareness: Be aware of surroundings.
                *   Valuables: Keep valuables secure, don't flaunt wealth.
                *   Transport: Use reputable transport.
                *   Respect Local Laws/Customs: Avoid potentially risky situations.
        *   **Emergency Information:**
            *   Know local emergency numbers.
            *   Locate nearest hospitals/clinics beforehand if possible.
            *   Know how to contact your travel insurance provider.
        *   **Disclaimer:** Reiterate that this is *general* advice and not a substitute for professional medical or safety advice specific to the individual and the exact destination (\`[City/Country]\`). Encourage checking official sources (CDC, WHO, local health ministries).
    
    5.  **Refine and Adapt for \`[City/Country]\`:**
        *   Insert \`[City/Country]\` in the intro and relevant sections.
        *   *Crucially*, add a strong placeholder message where specific vaccination and disease risks should be. Explain *why* I can't give specific details without knowing the location. For example: "Specific vaccination recommendations and health risks vary greatly depending on the exact location within \`[City/Country]\`, your itinerary, and your health history."
        *   Ensure the tone is helpful and encouraging, not overly alarmist.
        *   Keep sentences relatively short and points concise to maintain "briefness." Use bullet points.
    
    6.  **Review and Edit:**
        *   Is it brief? Yes, uses bullet points and concise language.
        *   Does it cover all requested points (vaccinations, food/water, health tips)? Yes.
        *   Is it adaptable for \`[City/Country]\`? Yes, by using the placeholder.
        *   Is the disclaimer clear? Yes.
        *   Is the advice practical? Yes.
        *   Is the flow logical? Yes.
        *   Check for clarity and grammar. Ensure the call to action (consult doctor, check official sources) is prominent.
    
    7.  **Final Polish:** Add a clear title. Make the placeholder for \`[City/Country]\` obvious. Ensure the opening and closing are welcoming and helpful.`,
          },
          {
            text: `Okay, here is a brief health and safety travel guide template for a tourist visiting **[City/Country]**. Remember to replace \`[City/Country]\` with your actual destination and **always consult a healthcare professional and check official government travel advisories before your trip** for personalized advice.
    
    ---
    
    **Brief Health & Safety Travel Guide for [City/Country]**
    
    Welcome to **[City/Country]**! To help ensure a healthy and safe trip, keep the following points in mind:
    
    **1. Before You Go: Consult & Prepare**
    
    *   **See Your Doctor:** Visit your doctor or a travel clinic **4-6 weeks before you travel**. They can provide personalized advice based on your health history and itinerary.
    *   **Routine Vaccinations:** Ensure your`,
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: `${destination}`,
          },
        ],
      },
    ];

    // Call the Gemini API
    const response = await geminiAPI.models.generateContent({
      model,
      config,
      contents,
    });

    // Return the safety guide
    res.json({
      success: true,
      destination: destination,
      safetyGuide: response.text,
    });
  } catch (error) {
    console.error("Error generating travel safety guide:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate travel safety guide",
      details: error.message,
    });
  }
});

app.post("/api/getTravelEmergencyContacts", async (req, res) => {
  try {
    const { destination } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        error: "Destination is required",
      });
    }

    // Create the model prompt
    const model = "gemini-2.5-flash-preview-04-17";
    const config = {
      responseMimeType: "text/plain",
    };

    // Format the contents with the template from the example
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `What are the emergency contact numbers and the nearest hospital for tourists in ${destination}?`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: `Here's a thinking process to arrive at the helpful response for a tourist asking for emergency contacts and hospitals:
    
    1.  **Identify the Core Request:** The user wants emergency contact numbers and the nearest hospital for tourists in a *specific* location ([City/Country]).
    
    2.  **Recognize the Missing Information:** The key piece of information – the actual city or country – is missing. The user used a placeholder "[City/Country]".
    
    3.  **Determine the Primary Constraint:** I cannot provide specific, accurate information without knowing the location. Emergency numbers and hospital locations are *highly* location-dependent.
    
    4.  **Formulate the Direct Answer (Addressing the Missing Info):** State clearly that I need the specific city or country to provide the correct information. Explain *why* this information is necessary (emergency numbers vary, hospital locations vary).
    
    5.  **Provide General Guidance (Fallback/Helpful Context):** Since I can't give the *specific* numbers, I can give general, useful information that applies *everywhere* or *most* places, or guidance on *how* the user can find the information themselves.
        *   **Common Emergency Numbers:** Mention common universal or widely recognized numbers like 112 (EU/many places) and 911 (North America). *Caution:* Emphasize that these aren't universal and depend on the location.
        *   **How to Find the Information:** Suggest reliable ways a tourist can find this information *once they know their location*:
            *   Local authorities' websites (police, government).
            *   Tourism websites (official tourism boards).
            *   Hotel concierge/staff.
            *   Local guidebooks/maps.
            *   Asking locals (if language is not a barrier).
            *   Using online search engines or map apps (like Google Maps) *with the location specified*.
        *   **What to Include in the Response (Structure):**
            *   Start by stating the need for the location.
            *   Explain *why* the location is needed.
            *   Give examples of common *types* of emergency numbers (police, fire, ambulance).
            *   Mention common *international* numbers (like 112) but stress they aren't universal.
            *   Provide methods for the user to find the *actual* information for their specific location.
            *   Add advice on *what* to do in an emergency (stay calm, location, nature of emergency, etc. - *Self-correction:* Keep this brief, the main focus is getting the numbers/location).
            *   Add advice on finding a *hospital* (mentioning using map apps is key here).
    
    6.  **Refine the Language:**
        *   Be clear and direct.
        *   Be helpful and reassuring.
        *   Use formatting (like bullet points) to make the information easy to read.
        *   Use bold text for emphasis on key phrases (like "Please provide the [City/Country]").
    
    7.  **Construct the Final Response:**
    
        *   "Hello! To give you the correct emergency contact numbers and information about the nearest hospital, I need to know which **[City/Country]** you are asking about." (Directly address the placeholder)
        *   "Emergency numbers vary significantly from country to country (and sometimes even within regions of a large country), and the nearest hospital obviously depends on your specific location." (Explain the *why*)
        *   "**Once you provide the location, I can try to help you find:**" (Transition to what I *can* do)
            *   General emergency number (Police, Fire, Ambulance - might be one number or separate).
            *   Specific hospital names and contact information that might be nearby.
        *   "**In the meantime, here is some general advice for finding this information:**" (Provide helpful alternative methods)
            *   "**Common International Emergency Numbers:** While not universal, numbers like 112 (used in the EU and many other countries) or 911 (used in North America and some other places) are worth being aware of, but *always* verify the correct number for your specific location." (Mention common numbers with a *strong* caveat)
            *   "**How to Find Local Information:**" (List concrete actions)
                *   Check the official tourism website for the city/country.
                *   Ask your hotel's front desk or concierge.
                *   Look in local guidebooks or maps designed for tourists.
                *   Search online using a search engine or map app (like Google Maps) with the *specific* city/country name and terms like "emergency number [City/Country]" or "hospitals near me [City/Country]".
                *   Look for official government or police websites for the area.
        *   "**Please tell me the [City/Country] you are in or plan to visit, and I will do my best to provide the specific information.**" (Reiterate the call to action)
    
    8.  **Final Review:** Does the response directly address the user's request? Yes, by explaining why it *can't* be answered yet. Does it provide useful information? Yes, by giving general advice and explaining *how* to find the information. Is it clear and easy to understand? Yes.`,
          },
          {
            text: `Hello! To give you the correct emergency contact numbers and information about the nearest hospital, I need to know which **[City/Country]** you are asking about.
    
    Emergency numbers vary significantly from country to country (and sometimes even within regions of a large country), and the nearest hospital obviously depends on your specific location.
    
    **Please provide the [City/Country]**, and I will do my best to provide the specific information, such as:
    
    1.  **General Emergency Number(s):** (Often one number for Police, Fire, Ambulance, but sometimes separate)
    2.  **Specific Hospitals:** Names, addresses, and potentially contact information for hospitals in or near that location.
    
    **In the meantime, here is some general advice for finding this information:**
    
    *   **Common International Emergency Numbers:** While not universal, numbers like **112** (used in the EU and many other`,
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: `${destination}`,
          },
        ],
      },
    ];

    // Call the Gemini API
    const response = await geminiAPI.models.generateContent({
      model,
      config,
      contents,
    });

    // Return the emergency contacts
    res.json({
      success: true,
      destination: destination,
      emergencyContacts: response.text,
    });
  } catch (error) {
    console.error("Error generating emergency contacts information:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate emergency contacts",
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
