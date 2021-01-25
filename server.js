import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
//import { isEmail } from 'validator'
import endpoints from "express-list-endpoints"
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import cloudinaryFramework from 'cloudinary'
import multer from 'multer'
import cloudinaryStorage from 'multer-storage-cloudinary'

import wineData from './data/wines.json'
import producersData from './data/producers.json'
import { Wine, Producer, User } from './models/models'

//default mongo-code:
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/hanna-final-project"
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
})
mongoose.Promise = Promise

//For setting upp .env (pictures):
dotenv.config()

//start express server on 8080
const port = process.env.PORT || 8080
const app = express()

//Error-messages:
const GET_ENDPOINTS_ERROR = 'Error: No endpoints found'

// Middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

//Setting up cloudinary for pictures in API:
//I only need this if I am going to upload pictures.
const cloudinary = cloudinaryFramework.v2
cloudinary.config({
  cloud_name: 'dtgjz72kj',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary,
  params: {
    folder: 'winepictures', //the folder in cloudinary
    allowedFormats: ['jpg', 'png', 'WebP', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
})
const parser = multer({ storage })

// NOT SURE ABOUT IF/WHY I SHOULD INCLUDE THIS ENDPOINT 
// I don't want to post pictures (if I don't add a possibility to add a wine), only include them in the API.
// app.post('/winepictures', parser.single('image'), async (req, res) => {
//   res.json({ imageUrl: req.file.path, imageId: req.file.filename })
// })

//Error if database is down:
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next()
  } else {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// Middleware to authenticate user:
const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      accessToken: req.header('Authorization'),
    });

    if (!user) {
      throw USER_NOT_FOUND;
    }
    req.user = user;
    next(); // Calling the next-function allows the protected endpoint to continue execution
  } catch (err) {
    res.status(401).json({ message: 'User not fouund', errors: err.errors });
  }
};

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
          (item) => item.producer_name === wineItem.producer
        )
      });
      await newWine.save();
    })
  }
  populateDatabase();
}

////// ROUTES / ENDPOINTS ////////
// see: https://mongoosejs.com/docs/queries.html

// Start defining your routes here
app.get('/', (req, res) => {
  if (res) {
    res.status(200).send(endpoints(app))
  } else {
    res.status(404).send({ error: GET_ENDPOINTS_ERROR })
  }
})

// GET All wines in database:
// Query on: name, country, origin, grape, type. Sort on: name, average rating and average price 
// Example: 
// http://localhost:8080/wines?type=red&country=france&sort=average_price_desc

app.get('/wines', async (req, res) => {
  // const queryParameters = req.query <-- don't need this? week 18 lecture 2 @34:00
  const { name, country, origin, grape, type } = req.query 
  const sort = req.query.sort

  const sortedWines = sort => {
    if (sort === 'name_asc') {
      return { name: 'asc' } 
    } else if (sort === 'name_desc') {
      return {name: 'desc' }
    } else if (sort === 'average_rating_asc') {
      return { average_rating: 'asc'} 
    } else if (sort === 'average_rating_desc') {
      return { average_rating: 'desc'}
    } else if (sort === 'average_price_asc') {
      return { average_price: 'asc'}
    } else if (sort === 'average_price_desc') {
      return { average_price: 'desc'}
    } else {
      return { name: 'asc'} //Default sorting
    }
  }
  
  const allWines = await Wine.find({
    name: new RegExp(name, 'i'), // Makes queries case-insensitive. Is there an easier way to specify this?
    country: new RegExp(country, 'i'),
    origin: new RegExp(origin, 'i'),
    grape: new RegExp(grape, 'i'),
    type: new RegExp(type, 'i')
  })
    .populate('producer')
    .sort(sortedWines(sort)) 

  if (allWines) {
    res.json(allWines)
  } else {
    res.status(404).json({ error: 'Could not find wines' })
  }
})

//GET single wine by id (single wine object): 
app.get('/wines/:id', async (req, res) => {
  const { id } = req.params
  try {
    const singleWine = await Wine.findOne({ _id: id })
    res.json(singleWine)
  } catch (err) {
    res.status(404).json({
      message: `Could not find any wine with id: ${id}`,
      error: err
    })
  }
})

//This works!
//GET all producers:
app.get('/producers', async (req, res) => {
  const allProducers = await Producer.find(req.query)
  res.json(allProducers)
})

//THIS Works!
//GET a single producer;
app.get('/producers/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const singleProducer = await Producer.findById({ _id: id })
      if (!singleProducer) {
        throw 'Producer not found'
      } 
    res.status(200).json(singleProducer)
  } catch (err) {
    res.status(404).json({ 
      message: `Could not find a producer with id: ${id}`,
      errors: err.errors
    })
  }
})

//THIS WORKS!
//GET all wines from a specific producer:
//EXAMPLE: http://localhost:8080/producers/600d890d1a4d7a09c404308/wines
app.get('/producers/:id/wines', async (req, res) => {
  try {
    const producer = await Producer.findById(req.params.id)
    const winesFromProducer = await Wine.find({ producer: mongoose.Types.ObjectId(producer.id) })
    if (winesFromProducer) {
      res.status(200).json(winesFromProducer)
    } else {
      throw 'Could not find any wines from this producer'
    }
  } catch (err) {
    res.status(404).json({
      message: 'Could not find any wines from this producer',
      errors: err.errors
    })
  }
})

/// TO DO: ///
//PUT or PATCH (or POST) to update a wine (with postman, not on the frontend)???
//use mongoose updateOne? Check $ Set operator in mongo DB also (see Q&A wed week 21)

////// USER-ENDPOINTS /////////
//////////////////////////////

//This works in Postman!
//POST: registration endpoint (creates user)
app.post('/users', async (req, res) => {
  try {
    const { name, surname, email, password } = req.body
    const user = await new User({
      name,
      surname,
      email,
      password
    }).save()
    res.status(200).json({
      userId: user._id,
      name: user.name,
      surname: user.surname,
      accessToken: user.accessToken,
    })
  } catch (err) {
    res.status(400).json({
      message: 'Could not create user',
      errors: { message: err.message, error: err },
    })
  }
})

//This works in Postman!
//POST: login user
app.post('/sessions', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (user && bcrypt.compareSync(password, user.password)) {
      user.accessToken = crypto.randomBytes(128).toString('hex')

      const updatedUser = await user.save()
      res.status(200).json({
        userId: updatedUser._id,
        accessToken: updatedUser.accessToken,
        name: updatedUser.name,
        //Are these two  (id & accesstoken) enough here? Does name have to be here? Or email?
      })
    } else {
      throw 'User not found'
    }
  } catch (err) {
    res.status(404).json({
      message: 'User not found',
      errors: { message: err.message, error: err }
    })
  }
})

//This works in Postman!
// POST: logout user
app.post('/users/logout', authenticateUser)
app.post('/users/logout', async (req, res) => {
  try {
    req.user.accessToken = null
    await req.user.save()
    res.status(200).json('User is logged out')
  } catch (err) {
    res.status(400).json({
      message: 'Log out failed',
      errors: { error: 'Log out failed' }
    })
  }
})

//This works in Postman!
//GET: secure endpoint, protected bu authenticateUser (user-page: my_collection).
//Looks up the user based on the access token stored in the header:
//http://localhost:8080/users/600d56a220bee6056d5bbe1a/my_collection
//And send value: Access token, key: Authorization in headers in Postman
app.get('/users/:id/my_collection', authenticateUser) // What should the path be? users/:id OR users/:id/wines OR users/:id/my_collection ????
app.get('/users/:id/my_collection', async (req, res) => {
  try {
    const userId = req.params.id
    if (userId != req.user._id) {
      throw 'Access denied'
    }
    const userPageMessage = `Hello ${req.user.name}! This is your wine-collection.`
    res.status(200).json(userPageMessage)
    //How do I handle if I want to show more info here than just a message?
    // If all of the info on the user-page shall be protected by login?
  } catch (err) {
    res.status(403).json({
      message: 'Access denied',
      errors: { error: 'Access denied' }
    })
  }
})
///    TO DO:     ///
//endpoint for user to add a wine to favorites?? --> Q&A: Push a favourite wine into the array for the user on the protected endpoint. How???
//endpoint for user to rate a wine.
//(endpoint for user to add a new wine to the database/API? NOT MVP!)
//endpoint to GET users favorites and/ or rated wines.


// THIS DOES NOT WORK:

// PUT: (UPDATE USER: add a favorite wine to User) Testing endpoint to add favorite for a logged-in user:
// I want to update the user-model and add the selected wine to the favoriteWines-array for that user. How do I do that?
app.put('/users/:id/my_collection', authenticateUser)
app.put('/users/:id/my_collection', async (req, res) => {
  const userId = req.params.id

  const { } = req.body // what to put here?
  const selectedWine = await Wine // Find the actual wine the user wants to add. How?

  try {
    await User.findOneAndUpdate(
      { _id: userId }, 
      {$push: {favoriteWines: selectedWine }} //Somehow push the selected wine into the favoriteWines-array
      )
      res.status(200).json(selectedWine) 
    // const selectedWine = await new Wine({}).populate('favoriteWines').save()
    // const addSelectedFavoriteToUser = await User.findOneAndUpdate({favoriteWines: mongoose.Types.ObjectId(selectedWine)})
    // if (addSelectedFavoriteToUser) {
    //   res.status(200).json(addSelectedFavoriteToUser).save() //Save??
    // } else {
    //   throw 'Could not add favorite wine to user. User must be logged in to add a favorite wine.'
    // }
    // const userId = req.params.id
    // const { favoriteWines, } = req.body
    //const savedFavoriteWine = await User.findOneAndUpdate({ id: userId }, )
  } catch (err) {
    res.status(404).json({
      message: 'Could not add favorite wine to user. User must be logged in to add a favorite wine.',
      errors: err.errors
    })
  }
})

//Unused:
// const producer = await Producer.findById(req.params.id)
// const winesFromProducer = await Wine.find({ producer: mongoose.Types.ObjectId(producer.id) })


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
