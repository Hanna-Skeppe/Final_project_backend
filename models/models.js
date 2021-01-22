import mongoose from 'mongoose'

//Make schemas of this instead??? Like project auth
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
    enum: ['red', 'white', 'orange', 'rosé', 'sparkling', 'dessert'],
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
export default Wine

export const Producer = new mongoose.model('Producer', { // Should I add a picture to each producer?
  description: String,
  producer: { 
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
    type: String, 
    required: false
  },
})

export const User = new mongoose.model('User', {
  name: {
    type: String,
    required: true,
    minlength: [2, 'Name is too short. Minimum length is 2 characters.'],
    maxlength: [20, 'Name is too long. Maximum length is 20 characters.']
  },
  surname: {
    type: String,
    required: true,
    minlength: [2, 'Surname is too short. Minimum length is 2 characters.'],
    maxlength: [20, 'Surname is too long. Maximum length is 20 characters.']
  },
  username: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true,
    minlength: 5
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
})
// I could add comment option for user in ratedWines later on if there is time.