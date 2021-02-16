import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import endpoints from "express-list-endpoints"
import crypto from 'crypto'
import bcrypt from 'bcrypt'
// import dotenv from 'dotenv'
// import cloudinaryFramework from 'cloudinary'
// import multer from 'multer'
// import cloudinaryStorage from 'multer-storage-cloudinary'

import wineData from './data/wines.json'
import producersData from './data/producers.json'
import { Wine, Producer, User, RatedWine } from './models/models'

//default mongo-code:
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/hanna-final-project"
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
})
mongoose.Promise = Promise

//For setting upp .env (pictures):
// dotenv.config()

//start express server 
const port = process.env.PORT || 8080
const app = express()

//Error-messages:
const GET_ENDPOINTS_ERROR = 'Error: No endpoints found'

// Middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// Might use this code later if I add option to post picture (when user suggest a new wine to be added)
//Setting up cloudinary for pictures in API:
//I only need this if I am going to upload pictures.
// const cloudinary = cloudinaryFramework.v2
// cloudinary.config({
//   cloud_name: 'dtgjz72kj',
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// })

// const storage = cloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'winepictures', //the folder in cloudinary
//     allowedFormats: ['jpg', 'png', 'WebP', 'gif'],
//     transformation: [{ width: 500, height: 500, crop: 'limit' }],
//   },
// })
// const parser = multer({ storage })

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
// ROOT (endpoints):
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
// http://localhost:8080/wines?query=white&sort=average_price_asc
// see week 17 lecture 1 on filtering
app.get('/wines', async (req, res) => {
  
  const { query } = req.query
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
    $or: [ 
    { name: new RegExp(query, 'i') }, // queries case-insensitive. 
    { country: new RegExp(query, 'i') },
    { origin: new RegExp(query, 'i') },
    { grape: new RegExp(query, 'i') },
    { type: new RegExp(query, 'i') }
    ]
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
    const singleWine = await Wine.findById({ _id: id })
    res.json(singleWine)
  } catch (err) {
    res.status(404).json({
      message: `Could not find any wine with id: ${id}`,
      error: err
    })
  }
})

//GET all producers:
app.get('/producers', async (req, res) => {
  const allProducers = await Producer.find(req.query)
  res.json(allProducers)
})

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

//GET all wines from a specific producer:
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

////// USER-ENDPOINTS /////////

//POST: registration endpoint (create user)
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
        surname: updatedUser.surname
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

//GET: endpoint to get users saved favoriteWines
//Headers in Postman: key: Authorization, value: Access token. 
app.get('/users/:id/favorites', authenticateUser)
app.get('/users/:id/favorites', async (req, res) => {
  
  try {
    const userId = req.params.id
    if (userId != req.user._id) {
      throw 'Access denied'
    }
    const userFavoritesArray = await req.user.favoriteWines //--> shows array of added wines (wine-id:s)
    const getCurrentFavoriteWines = await Wine.find({ _id: userFavoritesArray }).populate('producer') // --> outputs the whole wine-objects in user favorites.
    res.status(200).json(getCurrentFavoriteWines)
  } catch (err) {
    res.status(403).json({
      message: 'Could not get favorite wines. User must be logged in to see favorite wines.',
      errors: { message: err.message, error: err }
    })
  }
})

// DELETE-ENDPOINT: for logged in user to remove a favorite wine
// UPDATES the user and removes the selected wine from the favoriteWines-array for that user.
app.delete('/users/:id/favorites', authenticateUser)
app.delete('/users/:id/favorites', async (req, res) => {
  const { id } = req.params 
  try {
    const userId = req.params.id
    if (userId != req.user.id) {
      throw 'Access denied'
    }
    const { _id } = req.body 
    console.log(_id)
    const selectedWine = await Wine.findById(_id) // Find the wine the user wants to remove
    console.log('selectedWine', selectedWine) // this prints the selected wine to delete
    await User.updateOne(
      {_id: id },
      { $pull: { favoriteWines: { $in: [ selectedWine ] }}} // update user favoriteWines after delete
    )
    res.status(200).json(selectedWine) 
  } catch (err) {
    res.status(403).json({
      message: 'Could not perform request to delete favorite wine. User must be logged in to do this.',
      errors: { message: err.message, error: err }
    })
  }
})

// PUT: endpoint to add favorite wine for a logged-in user (used with the first way where I don't have a separate model for RatedWines)
// UPDATES the user and adds the selected wine to the favoriteWines-array for that user.
app.put('/users/:id/favorites', authenticateUser) 
app.put('/users/:id/favorites', async (req, res) => {
  const { id } = req.params 

  try {
    const { _id } = req.body
    const selectedWine = await Wine.findById( _id ) // Find the wine the user wants to add. 
    await User.updateOne(
      { _id: id }, 
      {$push: {favoriteWines: selectedWine }} //push the selected wine into the favoriteWines-array
      )
      res.status(200).json(selectedWine) 
  } catch (err) {
    res.status(404).json({
      message: 'Could not add favorite wine. User must be logged in to add a favorite wine.',
      errors: { message: err.message, error: err }
    })
  }
})

// PUT-endpoint for user to rate a wine (Without a separate model/collection for rated wines):
// NOT FULLY WORKING YET! This adds one new instance everytime I rate a wine, regardless of wineId
// app.put('/users/:id/rated', authenticateUser)
// app.put('/users/:id/rated', async (req, res) => {
//   const { id } = req.params
//   try {
//     const wineId = req.body.wineId
//     const rating = req.body.rating
//     const selectedWine = await Wine.findById( wineId )
//     console.log('selectedWine', selectedWine)
//     // const currentUser = await User.findOne({ _id: id })
//     // console.log('currentUser', currentUser)
//     // const usersRatedWines = await currentUser.ratedWines
//     // console.log('userRatedWines', usersRatedWines)

//     const userRatingsArray = await req.user.ratedWines //--> shows users rated wines
//     console.log('userRatingsArray:', userRatingsArray)
//     // const getCurrentRatedWines = await Wine.find({ _id: userRatingsArray }).populate('producer') 
//     // const checkIfCurrentWineIsRated = await Wine.find({ _id: userRatingsArray.wineId })
//     console.log(userRatingsArray.includes(selectedWine._id)) // --> false
//     if (userRatingsArray.includes(selectedWine)) {
//       await User.updateOne(
//         { _id: id},
//         {$set: { rating: req.body.rating }}
//       )
//     } else { // This always happens, so a new instance is added each time I add a rating (several instances/ratings for the same wine)
//       await User.updateOne(
//         { _id: id}, 
//         {$push: {ratedWines: {rating: rating, wineId: selectedWine}}}
//       )
//     }
//     res.status(200).json(selectedWine)
//   } catch (err) {
//     res.status(404).json({
//       message: 'Could not rate wine. User must be logged in to rate a wine.',
//       errors: { message: err.message, error: err }
//     })
//   }
// })

// NOT IN USE: this did not work (findOneAndUpdate did not work on user ratedWines)
// const ratedWine = await User.ratedWines.findOne({ wineId: req.body.wineId, }) 
//     console.log('ratedWine:', ratedWine)
//     console.log('userRatingsArray:', userRatingsArray) //--> shows users rated wines
//     if (ratedWine) {
//       const updated = await User.ratedWines.findOneAndUpdate({ wineId: req.body.wineId, rating: req.body.rating })
//       res.status(201).json(updated)
//     } else {
//       await User.updateOne(
//         {_id: id},
//         {$push: {ratedWines: {rating: rating, wineId: selectedWine}}}
//       )
//     }
//     res.status(200).json(selectedWine)
//     console.log(updated)

// NOT IN USE: PUT-endpoint to update rating of a wine for a logged-in user (if I would use a separate collection for rated Wines):
app.put('/users/:userId/rated', authenticateUser)
app.put('/users/:userId/rated', async (req, res) => {
  // const { id } = req.params
  try {
    const { userId, wineId, rating } = req.body
    //if several users have rated the same wine, it will find the one with the right userId
    const savedWine = await RatedWine.findOne({ userId: req.body.userId, wineId: req.body.wineId })
    // if there is a saved rated wine, update it, else add it to RatedWine & User:
    if (savedWine) {
      const updated = await RatedWine.findOneAndUpdate({ userId: req.body.userId, wineId: req.body.wineId }, req.body, { new: true })
      res.status(201).json(updated)
    } else {
      const ratedWine = new RatedWine({ userId, wineId, rating })
      const saved = await ratedWine.save()
      await User.findOneAndUpdate(
        { _id: userId},
        { $push: { userRatedWines: saved }}
      )
      res.status(201).json(saved)
    }
  } catch (err) {
    res.status(404).json({
      message: 'Could not rate wine. User must be logged in to rate a wine.',
      errors: { message: err.message, error: err }
    })
  }
})

// Get list of all users rated wines:
//Headers in Postman: key: Authorization, value: Access token. 
app.get('/users/:userId/rated', authenticateUser)
app.get('/users/:userId/rated', async (req, res) => {
  try {
    const userId = req.params.userId
    if (userId != req.user._id) {
      throw 'Access denied'
    }
    const ratedWines = await RatedWine.find({ userId: userId })
    console.log('ratedWines', ratedWines) //--> shows object(s) from ratedWine-collection (_id, userId, wineId, rating)
    // await Wine.find({ _id: saved})
    res.status(201).json(ratedWines)
  } catch (err) {
    res.status(404).json({
      message: 'Could not get rated wines. User must be logged in to see rated wines.',
      errors: { message: err.message, error: err }
    })
  }
})


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

///   LEFT TO DO (NOT MVP):     ///
//endpoint for user to rate a wine.(NOT MVP)
//endpoint to GET users rated wines.(NOT MVP)
//endpoint to add a new wine to the database. (NOT MVP)
//endpoint where user can post a suggestion to add a new wine (save in a new model, and I can add it to wines if approved)(NOT MVP)
//PUT or PATCH (or POST) to update a wine (with postman, not on the frontend)(NOT MVP)
//use mongoose updateOne? Check $ Set operator in mongo DB also (see Q&A wed week 21)
