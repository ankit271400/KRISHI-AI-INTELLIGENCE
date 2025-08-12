import { createServer, type Server } from "http";
import type { Express } from "express";
import multer from "multer";
import { type InsertUser, insertUserSchema, insertCropScanSchema, insertPaymentSchema } from "@shared/schema";
import { storage } from "./storage";
import { krishiAIBot } from "./telegram-bot";
import { weatherService } from "./weather-service";

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);
  
  // User routes
  app.get("/api/users/wallet/:address", async (req, res) => {
    try {
      const user = await storage.getUserByWalletAddress(req.params.address);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Crop scanning routes
  app.post("/api/scan", upload.single('image'), async (req, res) => {
    try {
      // Mock AI crop analysis with realistic data
      const cropType = req.body.cropType || 'Unknown';
      const location = req.body.location || 'India';
      const premium = req.body.premium === 'true';
      
      const analysisResult = {
        id: Math.floor(Math.random() * 10000),
        cropType,
        healthStatus: Math.random() > 0.3 ? 'healthy' : 'diseased',
        confidence: (0.75 + Math.random() * 0.2).toFixed(2),
        diseases: Math.random() > 0.5 ? ['Leaf Spot', 'Early Blight'] : [],
        recommendations: [
          `Apply balanced NPK fertilizer for ${cropType}`,
          `Maintain proper irrigation schedule`,
          `Monitor for pest activity regularly`,
          premium ? 'Premium: Use organic pesticides for better yield' : 'Basic treatment sufficient'
        ],
        treatmentPlan: premium ? [
          'Week 1: Apply organic fungicide',
          'Week 2: Foliar nutrition spray',
          'Week 3: Monitor and adjust irrigation'
        ] : [
          'Apply standard treatment',
          'Regular monitoring required'
        ],
        imageUrl: req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : '/placeholder-crop.jpg',
        ipfsHash: `Qm${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString(),
        location,
        weatherConditions: {
          temperature: 25 + Math.random() * 10,
          humidity: 60 + Math.random() * 20,
          description: 'Partly cloudy'
        }
      };

      // Store the scan result
      if (premium) {
        const scanData = {
          userId: 1, // Mock user ID
          cropType,
          imageUrl: analysisResult.imageUrl,
          ipfsHash: analysisResult.ipfsHash,
          healthStatus: analysisResult.healthStatus,
          diseases: JSON.stringify(analysisResult.diseases),
          recommendations: analysisResult.recommendations.join('\n'),
          confidence: parseFloat(analysisResult.confidence),
          premium: true
        };
        
        // In real implementation, save to database
        // await storage.createCropScan(scanData);
      }

      res.json({
        success: true,
        scan: analysisResult,
        message: premium ? "Premium analysis completed" : "Basic analysis completed"
      });
    } catch (error) {
      console.error('Scan error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to analyze crop image" 
      });
    }
  });

  // Weather routes
  app.get("/api/weather/:location", async (req, res) => {
    try {
      const location = req.params.location;
      const weatherData = await weatherService.getCurrentWeather(location);
      
      // Add agricultural insights
      const insights = weatherService.getAgriculturalInsights(weatherData, 'Maharashtra');
      const recommendations = weatherService.getCropRecommendations(weatherData, 'Maharashtra');
      const pestAlerts = weatherService.getPestDiseaseAlert(weatherData, 'Maharashtra');
      
      res.json({
        current: weatherData,
        insights,
        recommendations: {
          recommendations,
          recommendedCrops: ['wheat', 'rice', 'cotton', 'maize', 'sugarcane'],
          recommendedVarieties: ['Local recommended varieties'],
          stateInfo: {
            soilType: 'Mixed',
            climate: 'Varied', 
            season: 'Kharif, Rabi',
            majorCrops: ['wheat', 'rice', 'cotton']
          }
        },
        pestAlerts: [],
        status: 'success',
        message: `Real weather data for ${location}`
      });
    } catch (error) {
      console.error('Weather error:', error);
      res.status(500).json({ 
        message: "Failed to fetch weather data",
        error: error.message 
      });
    }
  });

  // Farmer Q&A route
  app.post("/api/farmer-qa", async (req, res) => {
    try {
      const { question, language = 'hindi', category, context } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Question is required' 
        });
      }

      // Mock AI response with realistic agricultural advice
      const responses = {
        hindi: {
          pest: "कीट नियंत्रण के लिए नीम का तेल या बायो-पेस्टिसाइड का उपयोग करें। रासायनिक दवा से बचें।",
          irrigation: "दिन में दो बार पानी दें - सुबह और शाम। मिट्टी की नमी चेक करते रहें।", 
          market: "आज गेहूं का भाव ₹2,850 प्रति क्विंटल है। अगले महीने कीमत बढ़ने की संभावना है।",
          general: "आपके प्रश्न के अनुसार, वर्तमान मौसम में धान की खेती अच्छी होगी। उचित खाद और सिंचाई का ध्यान रखें।"
        },
        english: {
          pest: "Use neem oil or bio-pesticides for pest control. Avoid chemical pesticides when possible.",
          irrigation: "Water twice daily - morning and evening. Monitor soil moisture regularly.",
          market: "Today's wheat price is ₹2,850 per quintal. Prices expected to rise next month.",
          general: "Based on your question, paddy cultivation will be good this season. Maintain proper fertilizer and irrigation."
        }
      };

      const lang = language === 'hindi' ? 'hindi' : 'english';
      const responseCategory = category || 'general';
      const answer = responses[lang][responseCategory] || responses[lang].general;

      const response = {
        answer: answer,
        confidence: 0.85,
        sources: ['Agricultural Extension Services', 'Weather Department', 'Market Intelligence'],
        relatedQuestions: [
          language === 'hindi' ? 
            ['मिट्टी की जांच कैसे करें?', 'बीज का चुनाव कैसे करें?', 'खाद कब डालें?'] :
            ['How to test soil?', 'How to select seeds?', 'When to apply fertilizer?']
        ].flat(),
        actionItems: [
          language === 'hindi' ? 
            ['मिट्टी की नमी चेक करें', 'मौसम का पूर्वानुमान देखें', 'बाज़ार भाव की जानकारी लें'] :
            ['Check soil moisture', 'Monitor weather forecast', 'Track market prices']
        ].flat(),
        governmentSchemes: ['PM-KISAN', 'Crop Insurance Scheme', 'KCC - Kisan Credit Card']
      };

      res.json({
        success: true,
        answer: response
      });
    } catch (error) {
      console.error('Farmer QA error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process question" 
      });
    }
  });

  // Price negotiation route
  app.post("/api/price-negotiation", async (req, res) => {
    try {
      const { crop, quantity, quality = 'standard', location, marketType = 'local' } = req.body;
      
      if (!crop || !quantity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Crop type and quantity are required' 
        });
      }

      // Mock price analysis with realistic data
      const basePrices = {
        'गेहूं': 30, 'wheat': 30,
        'धान': 25, 'rice': 25, 
        'टमाटर': 45, 'tomato': 45,
        'प्याज': 35, 'onion': 35,
        'कपास': 55, 'cotton': 55
      };

      const basePrice = basePrices[crop] || basePrices[crop.toLowerCase()] || 32;
      const qualityMultiplier = quality === 'premium' ? 1.15 : quality === 'basic' ? 0.9 : 1.0;
      const recommendedPrice = Math.round(basePrice * qualityMultiplier);
      
      const negotiationStrategy = {
        recommendedPrice,
        minAcceptablePrice: Math.round(recommendedPrice * 0.88),
        maxNegotiationPrice: Math.round(recommendedPrice * 1.1),
        negotiationTactics: [
          "Emphasize high market demand and limited supply",
          "Set a firm price with minimal negotiation room", 
          "Highlight upward price trend and future price predictions",
          "Create urgency by mentioning potential price increases",
          "Prepare alternative buyers and competitive offers",
          "Use market intelligence and price comparison data",
          "Maintain flexibility while protecting minimum profit margins"
        ],
        marketAdvantages: [
          "High market confidence and stable demand patterns",
          "Direct farmer-to-buyer connection eliminates middleman costs", 
          "Flexible payment terms and delivery options available"
        ],
        bestTiming: "Current timing is optimal - prices are trending upward. Consider holding for 1-2 weeks if possible.",
        alternativeMarkets: [
          "Local mandis and agricultural markets",
          "Direct consumer sales and farmer markets",
          "National commodity exchanges (NCDEX, MCX)",
          "Online agricultural trading platforms", 
          "Food processing companies and mills",
          "Contract farming with agribusiness companies",
          "Government procurement schemes (MSP rates)"
        ]
      };

      const marketAnalysis = {
        crop,
        requestedQuantity: quantity,
        estimatedValue: recommendedPrice * quantity,
        qualityGrade: quality,
        marketType: marketType
      };

      res.json({
        success: true,
        negotiationStrategy,
        marketAnalysis
      });
    } catch (error) {
      console.error('Price negotiation error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate negotiation strategy" 
      });
    }
  });

  // Soil analysis route
  app.post("/api/soil-analysis", async (req, res) => {
    try {
      const { pH, nitrogen, phosphorus, potassium, organicMatter, moisture, temperature, region } = req.body;
      
      // Calculate health score based on optimal ranges
      let healthScore = 0;
      
      // pH score (optimal: 6.0-7.5)
      if (pH >= 6.0 && pH <= 7.5) healthScore += 20;
      else if (pH >= 5.5 && pH <= 8.0) healthScore += 15;
      else healthScore += 5;
      
      // NPK scores
      if (nitrogen >= 150 && nitrogen <= 300) healthScore += 20;
      else if (nitrogen >= 100) healthScore += 10;
      
      if (phosphorus >= 15 && phosphorus <= 40) healthScore += 20;
      else if (phosphorus >= 10) healthScore += 10;
      
      if (potassium >= 120 && potassium <= 250) healthScore += 20;
      else if (potassium >= 80) healthScore += 10;
      
      // Organic matter score (optimal: >2.5%)
      if (organicMatter >= 2.5) healthScore += 20;
      else if (organicMatter >= 1.5) healthScore += 15;
      else healthScore += 5;

      const soilAnalysis = {
        healthScore: Math.min(healthScore, 100),
        recommendations: [
          nitrogen < 150 ? "नाइट्रोजन की कमी - यूरिया या वर्मी कंपोस्ट डालें" : null,
          phosphorus < 15 ? "फास्फोरस की कमी - SSP या DAP का उपयोग करें" : null,
          potassium < 120 ? "पोटाश की कमी - MOP या SOP डालें" : null,
          pH < 6.0 ? "मिट्टी में चूना डालें - एसिडिटी कम करने के लिए" : null,
          pH > 8.0 ? "जिप्सम का उपयोग करें - क्षारीयता कम करने के लिए" : null,
          organicMatter < 2.0 ? "जैविक खाद बढ़ाएं - गोबर खाद या कंपोस्ट डालें" : null,
          "Apply urea (46-0-0) at 120-150 kg/hectare"
        ].filter(Boolean),
        suitableCrops: [
          "धान", "गेहूं", "मक्का", "कपास", "सोयाबीन", "गन्ना", 
          "केला", "नारियल", "जौ", "चना", "मटर", "सरसों", 
          "ज्वार", "बाजरा", "अरहर"
        ],
        fertilizer: {
          organic: [
            "गोबर की खाद - 5-10 टन प्रति हेक्टेयर",
            "वर्मी कंपोस्ट - 2-3 टन प्रति हेक्टेयर", 
            "हरी खाद - सनई, ढैंचा उगाकर मिट्टी में मिलाएं"
          ],
          chemical: [
            `यूरिया (46% N) - ${Math.max(130, 200 - nitrogen)} किलो प्रति हेक्टेयर`
          ]
        },
        irrigation: {
          frequency: moisture < 20 ? "सप्ताह में 3-4 बार" : "सप्ताह में 2-3 बार",
          amount: "25-30 मिमी प्रति सिंचाई", 
          method: "फ्लड इरिगेशन"
        },
        alerts: healthScore < 50 ? ["मिट्टी की स्थिति खराब है - तुरंत सुधार की आवश्यकता"] : []
      };

      res.json({
        success: true,
        soilAnalysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Soil analysis error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to analyze soil data" 
      });
    }
  });

  // Voice synthesis route  
  app.post("/api/voice/synthesize", async (req, res) => {
    try {
      const { text, language = 'hi' } = req.body;
      
      if (!text) {
        return res.status(400).json({ 
          success: false,
          message: 'Text is required for synthesis' 
        });
      }

      // Mock audio synthesis - in production, use actual TTS service
      const audioResponse = {
        audioUrl: `mock-audio-${Date.now()}.mp3`,
        language,
        duration: Math.ceil(text.length / 10), // Rough estimate
      };

      res.json(audioResponse);
    } catch (error) {
      console.error('Voice synthesis error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to synthesize voice" 
      });
    }
  });

  // Automated bidding route
  app.post("/api/automated-bidding", async (req, res) => {
    try {
      const { crop, quantity, maxPrice, duration } = req.body;
      
      const biddingResults = {
        status: "Active bidding in progress",
        currentBids: [
          {
            buyer: "Adani Agri Fresh",
            price: maxPrice * 0.95,
            terms: "Payment in 15 days, pickup from farm"
          },
          {
            buyer: "ITC Agri Business", 
            price: maxPrice * 1.02,
            terms: "Immediate payment, quality bonus included"
          },
          {
            buyer: "Local Cooperative Society",
            price: maxPrice * 0.98,
            terms: "Payment on delivery, transportation provided"
          }
        ],
        recommendations: [
          "ITC Agri Business offers best price with immediate payment",
          "Consider negotiating pickup costs with Adani Agri Fresh",
          "Local cooperative provides good backup option",
          "Monitor bids for next 2 hours before final decision"
        ]
      };

      res.json({
        success: true,
        biddingResults
      });
    } catch (error) {
      console.error('Bidding error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to start automated bidding" 
      });
    }
  });

  // International markets route
  app.post("/api/international-markets", async (req, res) => {
    try {
      const { crop, quantity } = req.body;
      
      const internationalOpportunities = {
        markets: [],
        estimatedReturns: [],
        requirements: [
          "Export license and registration",
          "Quality certifications and lab reports", 
          "Phytosanitary certificates",
          "Origin certificates",
          "International shipping arrangements",
          "Foreign exchange documentation",
          "Compliance with importing country regulations"
        ]
      };

      res.json({
        success: true,
        internationalOpportunities
      });
    } catch (error) {
      console.error('International markets error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to analyze international markets" 
      });
    }
  });

  return server;
}
