const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const memjs = require("memjs");

const app = express();

const PORT = 3000;

const MONGODB_URI = ""; //Your DB URI

const DATABASE_NAME = ""; //Your DB Name

const MEMCACHED_SERVER = "localhost:11211";

const memcached = memjs.Client.create(MEMCACHED_SERVER);

let db;
let usersCollection;


app.use(express.json());

app.use(express.static(path.join(__dirname)));

async function getCache(key) {
  try {
    const result = await memcached.get(key);

    if (!result.value) {
      return null;
    }

    return JSON.parse(result.value.toString());
  } catch (error) {
    console.error(`Cache GET error for ${key}:`, error);

    return null;
  }
}


async function setCache(key, data, ttl) {
  try {
    await memcached.set(
      key,
      JSON.stringify(data),
      {
        expires: ttl
      }
    );
  } catch (error) {
    console.error(`Cache SET error for ${key}:`, error);
  }
}


async function deleteCache(key) {
  try {
    await memcached.delete(key);
  } catch (error) {
    console.error(`Cache DELETE error for ${key}:`, error);
  }
}



async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);

    await client.connect();

    db = client.db(DATABASE_NAME);

    usersCollection = db.collection("users");

    console.log("Connected to MongoDB Atlas");

  } catch (error) {
    console.error("MongoDB connection error:", error);

    process.exit(1);
  }
}


//create user

app.post("/api/users", async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      gender,
      DOB
    } = req.body;

    if (!firstname || !lastname || !gender || !DOB) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const lastUser = await usersCollection
      .find({})
      .sort({ id: -1 })
      .limit(1)
      .toArray();

    const nextId =
      lastUser.length > 0
        ? lastUser[0].id + 1
        : 1;

    const newUser = {
      id: nextId,
      firstname,
      lastname,
      gender,
      DOB
    };

    await usersCollection.insertOne(newUser);

    await deleteCache("users:all");

    res.status(201).json(newUser);

  } catch (error) {
    console.error("Create user error:", error);

    res.status(500).json({
      message: "Failed to create user"
    });
  }
});


//get all users

app.get("/api/users", async (req, res) => {
  try {
    const cachedUsers = await getCache("users:all");

    if (cachedUsers) {
      console.log("GET /api/users - Cache HIT");

      return res.json(cachedUsers);
    }

    console.log("GET /api/users - Cache MISS");

    const users = await usersCollection
      .find({})
      .sort({ id: 1 })
      .toArray();


    await setCache(
      "users:all",
      users,
      300
    );

    res.json(users);

  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      message: "Failed to retrieve users"
    });
  }
});

//get single user

app.get("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const cacheKey = `user:${id}`;

    const cachedUser = await getCache(cacheKey);

    if (cachedUser) {
      console.log(
        `GET /api/users/${id} - Cache HIT`
      );

      return res.json(cachedUser);
    }

    console.log(
      `GET /api/users/${id} - Cache MISS`
    );

    const user = await usersCollection.findOne({
      id: id
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    await setCache(
      cacheKey,
      user,
      300
    );

    res.json(user);

  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Failed to retrieve user"
    });
  }
});

//update user

app.put("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      firstname,
      lastname,
      gender,
      DOB
    } = req.body;

    if (!firstname || !lastname || !gender || !DOB) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const updatedUser = {
      firstname,
      lastname,
      gender,
      DOB
    };

    const result = await usersCollection.updateOne(
      {
        id: id
      },
      {
        $set: updatedUser
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const user = await usersCollection.findOne({
      id: id
    });

    await deleteCache(`user:${id}`);

    await deleteCache("users:all");

    res.json(user);

  } catch (error) {
    console.error("Update user error:", error);

    res.status(500).json({
      message: "Failed to update user"
    });
  }
});

//delete user

app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const cacheKey = `user:${id}`;

    const cachedUser = await getCache(cacheKey);

    const result = await usersCollection.deleteOne({
      id: id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (cachedUser) {
      await setCache(
        cacheKey,
        cachedUser,
        30
      );

      console.log(
        `User ${id} deleted from MongoDB. ` +
        `Cache retained for 30 seconds.`
      );
    }

    await deleteCache("users:all");

    res.json({
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Delete user error:", error);

    res.status(500).json({
      message: "Failed to delete user"
    });
  }
});


async function startServer() {
  await connectToMongoDB();

  app.listen(PORT, () => {
    console.log(
      `Server running at http://localhost:${PORT}`
    );
  });
}

startServer();