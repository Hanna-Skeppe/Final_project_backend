import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

import wineData from './data/wines.json'
import producersData from './data/producers.json'
import { Wine, Producer, User } from './models/models'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/hanna-final-project"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
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

//Models/Schemas (moved to separate files)

// See lecture 2 week 18 @ 6:13 on how to populate database with several collections with relations!
//POPULATE DATABASE with several collections: seed database: (RESET_DATABASE=true npm run dev)
if (process.env.RESET_DATABASE) {
  const populateDatabase = async () => {
    //Clear current content:
    await Wine.deleteMany()
    await Producer.deleteMany()

    //Declare empty array in which later on will 
    //store all producers from producers.json (from Producer-model)
    let producers = []

    producersData.forEach(async (item) => {
      const newProducer = new Producer(item);
      
      //push each new producer to array 'producers' & save:
      producers.push(newProducer)
      await newProducer.save();
    })
    
    //(for reference: code from week 18 lecture 2)
    wineData.forEach(async wineItem => {
      const newWine = new Wine({
        ...wineItem, 
        producer: producers.find(
          (item) => item.producer === wineItem.producer
        )
      });
      await newWine.save();
    }) 
  }
  populateDatabase();
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

//THIS WORKS!!!
//GET a single producer;
app.get('/producers/:id', async (req, res) => {
  const { id } = req.params
  const singleProducer = await Producer.findById({ _id: id })
  if (singleProducer) {
    res.json(singleProducer)
  } else {
    res.status(404).json({ error: `Could not find a producer with id: ${id}` })
  }
})

//THIS WORKS!
//GET all wines from a specific producer:
app.get('/producers/:id/wines', async (req, res) => {
  const producer = await Producer.findById(req.params.id)
  const winesFromProducer = await Wine.find({ producer: mongoose.Types.ObjectId(producer.id)})
  res.json(winesFromProducer)
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
