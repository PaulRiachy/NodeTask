const API_URL = "/api/users";

const userForm = document.getElementById("userForm");
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const genderInput = document.getElementById("gender");
const dobInput = document.getElementById("dob");
const saveBtn = document.getElementById("saveBtn");

const tableBody = document.getElementById("tableBody");
const emptyMsg = document.getElementById("emptyMsg");

let editingUserId = null;
let authToken = null;

async function getAuthToken() {
  try {
    const response = await fetch("/api/auth/token", {
      method: "POST"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to get authentication token");
    }

    authToken = data.token;

  } catch (error) {
    console.error("Authentication error:", error);
  }
}

function validateForm() {
  const firstname = firstNameInput.value.trim();
  const lastname = lastNameInput.value.trim();
  const gender = genderInput.value;
  const DOB = dobInput.value;

  if (!firstname || !lastname || !gender || !DOB) {
    alert("Please fill in all fields.");
    return false;
  }

  return true;
}

userForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  const user = {
    firstname: firstNameInput.value.trim(),
    lastname: lastNameInput.value.trim(),
    gender: genderInput.value,
    DOB: dobInput.value
  };

  if (editingUserId !== null) {
    await updateUser(editingUserId, user);
  } else {
    await createUser(user);
  }
});


async function createUser(user) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(user)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create user");
    }

    console.log("User created:", data);

    userForm.reset();

    await getUsers();

  } catch (error) {
    console.error("Create user error:", error);
  }
}



async function getUsers() {
  try {
    if (!authToken) {
      await getAuthToken();
    }

    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const users = await response.json();

    if (!response.ok) {
      throw new Error(users.message || "Failed to retrieve users");
    }

    displayUsers(users);

  } catch (error) {
    console.error("Get users error:", error);
  }
}


function displayUsers(users) {
  tableBody.innerHTML = "";

  if (users.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";

  users.forEach(function (user) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.firstname}</td>
      <td>${user.lastname}</td>
      <td>${user.gender}</td>
      <td>${user.DOB}</td>
      <td>
        <button
          type="button"
          class="update-btn"
          onclick="editUser(${user.id})"
        >
          Update
        </button>
      </td>
      <td>
        <button
          type="button"
          class="delete-btn"
          onclick="deleteUser(${user.id})"
        >
          Delete
        </button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}


async function editUser(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`);

    const user = await response.json();

    if (!response.ok) {
      throw new Error(user.message || "Failed to retrieve user");
    }

    firstNameInput.value = user.firstname;
    lastNameInput.value = user.lastname;
    genderInput.value = user.gender;
    dobInput.value = user.DOB;

    editingUserId = user.id;

    saveBtn.textContent = "Update";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Edit user error:", error);
  }
}



async function updateUser(id, userData) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update user");
    }

    console.log("User updated:", data);

    editingUserId = null;

    saveBtn.textContent = "Save";

    userForm.reset();

    await getUsers();

  } catch (error) {
    console.error("Update user error:", error);
  }
}


async function deleteUser(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete user");
    }

    console.log("User deleted:", data);

    await getUsers();

  } catch (error) {
    console.error("Delete user error:", error);
  }
}


getUsers();