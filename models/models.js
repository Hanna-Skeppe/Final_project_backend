import mongoose from 'mongoose'
import { isEmail } from 'validator'
import crypto from 'crypto';
import bcrypt from 'bcrypt';

//Wine-model:
export const Wine = new mongoose.model('Wine', {
  name: {
    type: String,
    required: true,
    minlength: [4, 'Name is too short'],
    maxlength: [50, 'Name is too long']
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
    enum: ['red', 'white', 'orange', 'rosé', 'sparkling'],
    required: true,
  },
  grape: {
    type: String,
    required: true,
  },
  added_sulfites: {
    type: String,
    enum: ['yes', 'no', 'n/a']
  },
  goes_well_with: {
    type: String,
    required: false,
  },
  importer: {
    type: String,
    required: false,
  },
  average_price: {
    type: Number
  },
  image_url: {
    type: String //How to store images and what to put here?
  },
  average_rating: {
    type: Number
  },
  ratings_count: {
    type: Number
  },
  // text_reviews: { //Maybe include text-reviews later on
  //   type: Number
  // }
})

//Producer-model:
export const Producer = new mongoose.model('Producer', { 
  description: String,
  producer_name: { 
    type: String,
    required: true,
    minlength: [5, 'Producer name is too short. Minimum length is 5 characters.'],
    maxlength: [40, 'Producer name is too long. Maximum length is 30 characters.']
  },
  producer_country: {
    type: String,
    required: true
  },
  producer_image_url: {
    type: String,
    required: false
  },
  url: {
    type: String, 
    required: false
  },
})

//User-schema:
export const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: [2, 'Name is too short. Minimum length is 2 characters.'],
    maxlength: [30, 'Name is too long. Maximum length is 20 characters.']
  },
  surname: {
    type: String,
    required: true,
    minlength: [2, 'Surname is too short. Minimum length is 2 characters.'],
    maxlength: [30, 'Surname is too long. Maximum length is 20 characters.']
  },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    validate: [isEmail, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [5, 'Password must be minimum 5 characters'] 
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
  // isAdmin: { // Maybe include later on: create admin account via Postman? lecture 18/1 @14:04.
  //   type: Boolean,
  //   default: false
  // },
  favoriteWines: [{ //This will show as an array of id:s of wines from 'Wine' in each user (Q&A 18/1 @1:56)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wines'
  }],
  ratedWines: [{ //This will show as an array of objects: (rating & wineId from 'Wine') (Q&A 18/1 @1:58)
    rating: {
      type: Number,
      enum: [1, 2, 3, 4, 5]
    },
    wineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wines'
    }
  }]
}) // I could add comment/review option for user later on if there is time.

// Middleware to hash password before new user is saved:
userSchema.pre('save', async function (next) {
  const user = this
  
  if (!user.isModified('password')) {
    return next()
  }
  
  const salt = bcrypt.genSaltSync()
  user.password = bcrypt.hashSync(user.password, salt)
  next()
})

//User-model:
export const User = mongoose.model('User', userSchema)
