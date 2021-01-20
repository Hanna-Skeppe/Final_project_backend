import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

import wineData from './data/wines.json'
import producersData from './data/producers.json'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/hanna-final-project"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

//start express server on 8080
const port = process.env.PORT || 8080
const app = express()
const endpoints = require('express-list-endpoints')

//Error-messages:
const GET_ENDPOINTS_ERROR = 'Error: No endpoints found'

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

//Error if database is down:
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next()
  } else {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

//Models/Schemas:
const Wine = new mongoose.model('Wine', {
  name: {
    type: String,
    required: true,
    minlength: [4, 'Name is too short'],
    maxlength: [25, 'Name is too long']
  },
  country: {
    type: String,
    required: true,
    minlength: [2, 'Country name is too short. Minimum length is 4 characters.'],
    maxlength: [20, 'Country name is too long. Maximum length is 20 characters.']
  },
  origin: {
    type: String,
    required: true,
    minlength: [5, 'Origin name is too short. Minimum length is 5 characters.'],
    maxlength: [30, 'Origin name is too long. Maximum length is 30 characters.']
  },
  producer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producer',
  },
  year: {
    type: Number,
    required: true,
    minlength: [4, 'Specify year with four digits.'],
    maxlength: [4, 'Specify year with four digits.']
  },
  type: {
    type: String,
    enum: ['Red', 'White', 'Orange', 'Rosé', 'Sparkling', 'Dessert'],
    required: true,
  },
  grape: {
    type: String,
    required: true,
  },
  goes_well_with: {
    type: String,
    required: false,
  },
  importer: {
    type: String,
    required: false,
  },
  image_url: {
    type: String//How to store images and what to put here?
  },
  average_rating: {
    type: Number
  },
  ratings_count: {
    type: Number
  },
  // rated_wines: { // did Maks mean like this in Q&A 18/1???
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'RatedWines',
  // },
  text_reviews: { // Should this be text_reviews_count? Text reviews should be a model/schema?
    type: Number
  }
})

const Producer = new mongoose.model('Producer', {
  description: String, //<-- What is this 'description'?
  name: {
    type: String,
    required: true,
    minlength: [5, 'Producer name is too short. Minimum length is 5 characters.'],
    maxlength: [40, 'Producer name is too long. Maximum length is 30 characters.']
  },
  country: {
    type: String,
    required: true
  },
  url: {
    type: String, //??
    required: false
  },
})

// const User = new mongoose.model('User', {
//   name: {
//     type: String,
//   },
//   username: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 5
//   },
//   accessToken: {
//     type: String,
//     default: () => crypto.randomBytes(128).toString('hex')
//   },
  // isAdmin: { // create admin account via Postman? lecture 18/1 @14:04.
  //   type: Boolean,
  //   default: false
  // },
//   favoriteWines: [{ //Should I have favorites & ratings like this here, and should it be an array of objects?
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Wines' //Q&A 18/1: Not use a separate Favorite wines for this!
//   }],
//   ratedWines: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'RatedWines'
//   }]
// })

//Q&A 18/1: Should not be a separate model: I should reference to Wine-model when it comes to favorite wines.
// const FavoriteWines = new mongoose.model('FavoriteWines', {
//   description: String, // How should this model look like? It should save favorite wines to a user.
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   wineId: {
//     type: mongoose.Schema.Types.ObjectId, 
//   },
// })

// const RatedWines = new mongoose.model('RatedWines', {
//   // description: String, // How should this model look like? It should save rated wines to a user.
//   // userId: {
//   //   type: mongoose.Schema.Types.ObjectId, // relates to an object Id in User-model
//   //   ref: 'User'
//   // },
//   wineId: {
//     type: mongoose.Schema.Types.ObjectId, //Should this refer to Wine-model? Or should it just be type: String?
//     ref: 'Wine'
//   },
//   rating: { // Where do I store the actual rating? Is it here in this model?
//     type: Number
//   }
// })

// See lecture 2 week 18 @ 6:13 on how to populate database with several collections with relations!

//Populate/seed database: (RESET_DATABASE=true npm run dev)
//POPULATE DATABASE with several collections:
if (process.env.RESET_DATABASE) {
  const populateDatabase = async () => {
    //Clear current content of collections:
    await Wine.deleteMany()
    await Producer.deleteMany()

    //Declare empty array in which later on will 
    //store all producers from producers.json (from Producer-model)
    let producers = []

    producersData.forEach(async (item) => {
      const newProducer = new Producer(item);
      //push each new producer to producers (array) & save:
      producers.push(newProducer)
      await newProducer.save();
    })
    
    //(for reference: code from week 18 lecture 2)
    wineData.forEach(async wineItem => {
      const newWine = new Wine({
        ...wineItem, 
        producer: producers.find(item = item.producer === wineItem.producer
        )
      });
      await newWine.save()
    }) 
  }
  populateDatabase()
}

////// ROUTES / ENDPOINTS ////////
// see: https://mongoosejs.com/docs/queries.html
//Should I use if/else or try/catch for error-handling?

// Start defining your routes here
app.get('/', (req, res) => {
  if (res) {
    res.status(200).send(endpoints(app))
  } else {
    res.status(404).send({ error: GET_ENDPOINTS_ERROR })
  }
})

//GET All wines in database:
app.get('/wines', async (req, res) => {
  // const queryParameters = req.query <-- don't need this? week 18 lecture 2 @34:00
  // const { name, country, origin, producer, grape, type } = req.query  <-- don't need this?
  // see project mongo api on how to use regexp in the queries here
  const allWines = await Wine.find(req.query).populate('producer') // can I do a query by name like this?
  res.json(allWines)
})

//GET single wine (single wine object): // Should this enpoint have :id and not name? And to find by name I use query-param?
// should I change this to then / catch (week 18 lecture 2 @50 mins / ) or try / catch (week 19?)
app.get('/wines/:name', async (req, res) => {
  const { name } = req.params 
  const singleWine = await Wine.findOne({ name: name })
  res.json(singleWine)
})

//GET all producers:
app.get('/producers', async (req, res) =>{
    const allProducers = await Producer.find(req.query)
    res.json(allProducers)
})

//GET a single producer;
app.get('producers/:id', async (req, res) => {
  const producer = await Producer.findById(req.params.id)
  res.json(producer)
})

//GET all wines from a specific producer:
app.get('producers/:id/wines', async (req, res) => {
  const producer = await Producer.findById(req.params.id)
  const wines = await Book.find({ author: mongoose.Types.ObjectId(producer.id)})
  res.json(books)
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
