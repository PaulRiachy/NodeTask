require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const NodeCache = require("node-cache");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME;

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || "1h";

const cache = new NodeCache();

let db;
let usersCollection;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function getCache(key) {
  try {
    const data = cache.get(key);

    if (data === undefined) {
      console.log(`Cache MISS - ${key}`);
      return null;
    }

    console.log(`Cache HIT - ${key}`);
    return data;
  } catch (error) {
    console.error(`Cache GET error for ${key}:`, error);
    return null;
  }
}

async function setCache(key, data, ttl) {
  try {
    cache.set(key, data, ttl);
    console.log(`Cache SET - ${key} - TTL: ${ttl}s`);
  } catch (error) {
    console.error(`Cache SET error for ${key}:`, error);
  }
}

async function deleteCache(key) {
  try {
    cache.del(key);
    console.log(`Cache DELETE - ${key}`);
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }
}

app.post("/api/auth/token", (req, res) => {
  try {
    const payload = {
      type: "user"
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN
      }
    );

    res.json({
      token
    });
  } catch (error) {
    console.error("Token generation error:", error);

    res.status(500).json({
      message: "Failed to generate token"
    });
  }
});

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

app.get("/api/users", authenticateToken, async (req, res) => {
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

      await setCache("users:all", users, 300);

      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);

      res.status(500).json({
        message: "Failed to retrieve users"
      });
    }
  }
);

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

    await setCache(cacheKey, user, 300);

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Failed to retrieve user"
    });
  }
});

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
      { id: id },
      { $set: updatedUser }
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

app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cacheKey = `user:${id}`;

    const user = await usersCollection.findOne({
      id: id
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    await usersCollection.deleteOne({
      id: id
    });

    await setCache(cacheKey, user, 30);

    console.log(
      `User ${id} deleted from MongoDB. ` +
      `Individual cache retained for 30 seconds.`
    );

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