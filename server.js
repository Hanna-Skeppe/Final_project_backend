import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import endpoints from "express-list-endpoints";
import crypto from "crypto";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Wine, Producer, User, RatedWine } from "./models/models";
import wineData from "./data/wines.json";
import producersData from "./data/producers.json";
dotenv.config();

//Start express server
const port = process.env.PORT || 8080;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

//Connect to DB
const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost/hanna-final-project";
mongoose
  .connect(mongoURI)
  .then(() => console.log("Connected to database"))
  .catch((err) => console.error("Could not connect to database:", err));

//Error-messages:
const GET_ENDPOINTS_ERROR = "Error: No endpoints found";

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({ error: "Service unavailable" });
  }
});

// Middleware to authenticate user:
// Middleware to authenticate user:
const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from the Auth header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error("Token not provided");
    }

    const user = await User.findOne({ accessToken: token });

    if (!user) {
      throw USER_NOT_FOUND;
    }
    req.user = user;
    next(); // Call the next function to continue with the protected endpoint
  } catch (err) {
    res.status(401).json({ message: "User not found", errors: err.message });
  }
};
// const authenticateUser = async (req, res, next) => {
//   try {
//     const user = await User.findOne({
//       accessToken: req.header("Authorization"),
//     });

//     if (!user) {
//       throw USER_NOT_FOUND;
//     }
//     req.user = user;
//     next(); // Calling the next-function allows the protected endpoint to continue execution
//   } catch (err) {
//     res.status(401).json({ message: "User not fouund", errors: err.errors });
//   }
// };

if (process.env.RESET_DATABASE) {
  const populateDatabase = async () => {
    console.log("re-seeding database");
    await Wine.deleteMany();
    await Producer.deleteMany();

    let producers = [];
    producersData.forEach(async (item) => {
      const newProducer = new Producer(item);
      producers.push(newProducer);
      await newProducer.save();
    });
    wineData.forEach(async (wineItem) => {
      const newWine = new Wine({
        ...wineItem,
        producer: producers.find(
          (item) => item.producer_name === wineItem.producer
        ),
      });
      await newWine.save();
    });
  };
  populateDatabase();
}

////// ROUTES / ENDPOINTS ////////

// ROOT
app.get("/", (req, res) => {
  if (res) {
    res.status(200).send(endpoints(app));
  } else {
    res.status(404).send({ error: GET_ENDPOINTS_ERROR });
  }
});

app.get("/wines", async (req, res) => {
  try {
    const { query } = req.query; // Query on: name, country, origin, grape, type.
    const sort = req.query.sort;

    const sortedWines = (sort) => {
      if (sort === "name_asc") {
        return { name: "asc" };
      } else if (sort === "name_desc") {
        return { name: "desc" };
      } else if (sort === "average_rating_asc") {
        return { average_rating: "asc" };
      } else if (sort === "average_rating_desc") {
        return { average_rating: "desc" };
      } else if (sort === "average_price_asc") {
        return { average_price: "asc" };
      } else if (sort === "average_price_desc") {
        return { average_price: "desc" };
      } else {
        return { name: "asc" };
      }
    };

    const allWines = await Wine.find({
      $or: [
        { name: new RegExp(query, "i") },
        { country: new RegExp(query, "i") },
        { origin: new RegExp(query, "i") },
        { grape: new RegExp(query, "i") },
        { type: new RegExp(query, "i") },
      ],
    })
      .populate("producer")
      .sort(sortedWines(sort));

    if (allWines.length > 0) {
      res.json(allWines);
    } else {
      res.status(404).json({ error: "Could not find wines" });
    }
  } catch (err) {
    console.error("Error fetching wines");
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/wines/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const singleWine = await Wine.findById({ _id: id });
    res.json(singleWine);
  } catch (err) {
    res.status(404).json({
      message: `Could not find any wine with id: ${id}`,
      error: err.message,
    });
  }
});

app.get("/producers", async (req, res) => {
  try {
    const allProducers = await Producer.find(req.query);
    res.json(allProducers);
  } catch (err) {
    console.error("Error fetching producers");
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/producers/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.error(`Invalid Producer ID: ${id}`);
    return res.status(400).json({
      message: "Invalid Producer ID format",
    });
  }

  try {
    const singleProducer = await Producer.findById({ _id: id });
    if (!singleProducer) {
      return res.status(404).json({
        message: `Could not find a producer with id: ${id}`,
      });
    }
    res.status(200).json(singleProducer);
  } catch (err) {
    console.error("Error fetching wines. err:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/producers/:id/wines", async (req, res) => {
  const producerId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(producerId)) {
    console.error(`Invalid Producer ID: ${producerId}`);
    return res.status(400).json({
      message: "Invalid Producer ID format",
    });
  }

  try {
    const producer = await Producer.findById(producerId);

    if (!producer) {
      console.warn(`Producer not found for ID: ${producerId}`);
      return res.status(404).json({
        message: "Producer not found",
      });
    }

    const winesFromProducer = await Wine.find({
      producer: producer._id,
    });

    if (winesFromProducer.length > 0) {
      res.status(200).json(winesFromProducer);
    } else {
      return res.status(404).json({
        message: "Could not find any wines from this producer",
      });
    }
  } catch (err) {
    console.error("Error fetching wines. err:", err);

    return res.status(500).json({ error: "Internal server error" });
  }
});

////// USER-ENDPOINTS /////////

// create user
app.post("/users", async (req, res) => {
  try {
    const { name, surname, email, password } = req.body;
    const user = await new User({
      name,
      surname,
      email,
      password,
    }).save();
    res.status(200).json({
      userId: user._id,
      name: user.name,
      surname: user.surname,
      accessToken: user.accessToken,
    });
  } catch (err) {
    res.status(400).json({
      message: "Could not create user",
      errors: { message: err.message, error: err },
    });
  }
});

// login user
app.post("/sessions", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && bcrypt.compareSync(password, user.password)) {
      user.accessToken = crypto.randomBytes(128).toString("hex");
      const updatedUser = await user.save();
      res.status(200).json({
        userId: updatedUser._id,
        accessToken: updatedUser.accessToken,
        name: updatedUser.name,
        surname: updatedUser.surname,
      });
    } else {
      throw new Error("User not found");
    }
  } catch (err) {
    res.status(404).json({
      message: "User not found",
      errors: { message: err.message, error: err },
    });
  }
});

app.post("/users/logout", authenticateUser);
app.post("/users/logout", async (req, res) => {
  try {
    req.user.accessToken = null;
    await req.user.save();
    res.status(200).json("User is logged out");
  } catch (err) {
    res.status(400).json({
      message: "Log out failed",
      errors: { error: "Log out failed" },
    });
  }
});

// get users favoriteWines
app.get("/users/:id/favorites", authenticateUser);
app.get("/users/:id/favorites", async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId != req.user._id) {
      throw new Error("Access denied");
    }
    const userFavoritesArray = await req.user.favoriteWines;
    const getCurrentFavoriteWines = await Wine.find({
      _id: userFavoritesArray,
    }).populate("producer");
    res.status(200).json(getCurrentFavoriteWines);
  } catch (err) {
    res.status(403).json({
      message:
        "Could not get favorite wines. User must be logged in to see favorite wines.",
      errors: { message: err.message, error: err },
    });
  }
});

// remove a favorite wine
app.delete("/users/:id/favorites", authenticateUser);
app.delete("/users/:id/favorites", async (req, res) => {
  const { id } = req.params;
  try {
    const userId = req.params.id;
    if (userId != req.user.id) {
      throw new Error("Access denied");
    }
    const { _id } = req.body;
    const selectedWine = await Wine.findById(_id);
    await User.updateOne(
      { _id: id },
      { $pull: { favoriteWines: { $in: [selectedWine] } } }
    );
    res.status(200).json(selectedWine);
  } catch (err) {
    res.status(403).json({
      message:
        "Could not perform request to delete favorite wine. User must be logged in to do this.",
      errors: { message: err.message, error: err },
    });
  }
});

// add favorite wine
app.put("/users/:id/favorites", authenticateUser);
app.put("/users/:id/favorites", async (req, res) => {
  const { id } = req.params;
  try {
    const { _id } = req.body;
    const selectedWine = await Wine.findById(_id);
    await User.updateOne(
      { _id: id },
      { $push: { favoriteWines: selectedWine } }
    );
    res.status(200).json(selectedWine);
  } catch (err) {
    res.status(404).json({
      message:
        "Could not add favorite wine. User must be logged in to add a favorite wine.",
      errors: { message: err.message, error: err },
    });
  }
});

// update rating of a wine:
app.put("/users/:userId/rated", authenticateUser);
app.put("/users/:userId/rated", async (req, res) => {
  try {
    const { userId, wineId, rating } = req.body;
    //if several users have rated the same wine, find the one with the right userId
    const savedWine = await RatedWine.findOne({
      userId: req.body.userId,
      wineId: req.body.wineId,
    });
    // if there is a saved rated wine, update it, else add it to RatedWine & User:
    if (savedWine) {
      const updated = await RatedWine.findOneAndUpdate(
        { userId: req.body.userId, wineId: req.body.wineId },
        req.body,
        { new: true }
      );
      res.status(201).json(updated);
    } else {
      const ratedWine = new RatedWine({ userId, wineId, rating });
      const saved = await ratedWine.save();
      await User.findOneAndUpdate(
        { _id: userId },
        { $push: { userRatedWines: saved } }
      );
      res.status(201).json(saved);
    }
  } catch (err) {
    res.status(404).json({
      message: "Could not rate wine. User must be logged in to rate a wine.",
      errors: { message: err.message, error: err },
    });
  }
});

// get rated wines:
app.get("/users/:userId/rated", authenticateUser);
app.get("/users/:userId/rated", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (userId != req.user._id) {
      throw new Error("Access denied");
    }
    const ratedWines = await RatedWine.find({ userId: userId });
    res.status(201).json(ratedWines);
  } catch (err) {
    res.status(404).json({
      message:
        "Could not get rated wines. User must be logged in to see rated wines.",
      errors: { message: err.message, error: err },
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
