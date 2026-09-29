const API_URL = "/api/users";

const userForm = document.getElementById("userForm");
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const genderInput = document.getElementById("gender");
const dobInput = document.getElementById("dob");
const saveBtn = document.getElementById("saveBtn");

const tableBody = document.getElementById("tableBody");
const emptyMsg = document.getElementById("emptyMsg");

const profileUserSelect =
  document.getElementById("profileUserSelect");

const profileUserName =
  document.getElementById("profileUserName");

const profilePictureInput =
  document.getElementById("profilePictureInput");

const uploadProfilePictureBtn =
  document.getElementById(
    "uploadProfilePictureBtn"
  );

const profilePicture =
  document.getElementById("profilePicture");

const noProfilePicture =
  document.getElementById(
    "noProfilePicture"
  );

const profileUploadMessage =
  document.getElementById(
    "profileUploadMessage"
  );

let editingUserId = null;
let authToken = null;


async function getAuthToken() {
  try {
    const response = await fetch(
      "/api/auth/token",
      {
        method: "POST"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to get authentication token"
      );
    }

    authToken = data.token;
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );
  }
}


function validateForm() {
  const firstname = firstNameInput.value.trim();

  const lastname = lastNameInput.value.trim();

  const gender = genderInput.value;

  const DOB = dobInput.value;

  if (
    !firstname ||
    !lastname ||
    !gender ||
    !DOB
  ) {
    alert("Please fill in all fields.");
    return false;
  }

  return true;
}



userForm.addEventListener(
  "submit",
  async function (event) {
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
      await updateUser(
        editingUserId,
        user
      );
    } else {
      await createUser(user);
    }
  }
);


async function createUser(user) {
  try {
    const response = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(user)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to create user"
      );
    }

    console.log(
      "User created:",
      data
    );

    userForm.reset();

    await getUsers();
  } catch (error) {
    console.error(
      "Create user error:",
      error
    );
  }
}


async function getUsers() {
  try {
    if (!authToken) {
      await getAuthToken();
    }

    const response = await fetch(
      API_URL,
      {
        headers: {
          Authorization:
            `Bearer ${authToken}`
        }
      }
    );

    const users = await response.json();

    if (!response.ok) {
      throw new Error(
        users.message ||
          "Failed to retrieve users"
      );
    }

    displayUsers(users);
    populateProfileUserSelect(users);
  } catch (error) {
    console.error(
      "Get users error:",
      error
    );
  }
}


function displayUsers(users) {
  tableBody.innerHTML = "";

  if (users.length === 0) {
    emptyMsg.style.display =
      "block";

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


function populateProfileUserSelect(users) {
  const currentValue = profileUserSelect.value;

  profileUserSelect.innerHTML = `<option value="">Select a user</option>`;

  users.forEach(function (user) {
    const option = document.createElement("option");

    option.value = user.id;

    option.textContent = `${user.firstname} ${user.lastname}`;

    profileUserSelect.appendChild(
      option
    );
  });

  if (
    currentValue &&
    users.some(
      user =>
        String(user.id) === currentValue
    )
  ) {
    profileUserSelect.value = currentValue;
  }
}


profileUserSelect.addEventListener("change", async function () {
    const userId = profileUserSelect.value;

    if (!userId) {
      return;
    }

    const placeholder =
      profileUserSelect.querySelector(
        'option[value=""]'
      );

    if (placeholder) {
      placeholder.remove();
    }

    await loadProfileUser(userId);
  }
);


async function loadProfileUser(id) {
  try {
    if (!authToken) {
      await getAuthToken();
    }

    const response = await fetch(
      `${API_URL}/${id}`,
      {
        headers: {
          Authorization:
            `Bearer ${authToken}`
        }
      }
    );

    const user = await response.json();

    if (!response.ok) {
      throw new Error(
        user.message ||
          "Failed to retrieve user"
      );
    }

    profileUserName.textContent =
      `${user.firstname} ${user.lastname}`;

    profileUploadMessage.style.display =
      "none";

    if (user.profilePicture) {
      profilePicture.src = user.profilePicture;

      profilePicture.style.display = "block";

      noProfilePicture.style.display = "none";
    } else {
      profilePicture.src = "";

      profilePicture.style.display = "none";

      noProfilePicture.style.display = "block";
    }
  } catch (error) {
    console.error(
      "Load profile user error:",
      error
    );
  }
}


uploadProfilePictureBtn.addEventListener("click", async function () {
    const userId = profileUserSelect.value;

    const file = profilePictureInput.files[0];

    profileUploadMessage.style.display = "none";

    if (!userId) {
      showProfileMessage(
        "Please select a user.",
        true
      );

      return;
    }

    if (!file) {
      showProfileMessage(
        "Please select an image.",
        true
      );

      return;
    }

    const formData = new FormData();

    formData.append(
      "profilePicture",
      file
    );

    try {
      if (!authToken) {
        await getAuthToken();
      }

      uploadProfilePictureBtn.disabled =
        true;

      const response = await fetch(
        `${API_URL}/${userId}/profile-picture`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${authToken}`
          },

          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to upload profile picture"
        );
      }

      showProfileMessage(
        "Profile picture uploaded successfully.",
        false
      );

      profilePictureInput.value =
        "";

      await loadProfileUser(
        userId
      );

      await getUsers();
    } catch (error) {
      showProfileMessage(
        error.message,
        true
      );

      console.error(
        "Profile picture upload error:",
        error
      );
    } finally {
      uploadProfilePictureBtn.disabled = false;
    }
  }
);


function showProfileMessage(
  message,
  isError
) {
  profileUploadMessage.textContent = message;

  profileUploadMessage.style.display = "block";

  if (isError) {
    profileUploadMessage.style.color = "red";
  } else {
    profileUploadMessage.style.color = "green";
  }
}


async function editUser(id) {
  try {
    if (!authToken) {
      await getAuthToken();
    }

    const response = await fetch(
      `${API_URL}/${id}`,
      {
        headers: {
          Authorization:
            `Bearer ${authToken}`
        }
      }
    );

    const user =
      await response.json();

    if (!response.ok) {
      throw new Error(
        user.message ||
          "Failed to retrieve user"
      );
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
    console.error(
      "Edit user error:",
      error
    );
  }
}


async function updateUser(
  id,
  userData
) {
  try {
    const response = await fetch(
      `${API_URL}/${id}`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${authToken}`
        },

        body: JSON.stringify(
          userData
        )
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to update user"
      );
    }

    console.log(
      "User updated:",
      data
    );

    editingUserId = null;

    saveBtn.textContent = "Save";

    userForm.reset();

    await getUsers();
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );
  }
}


async function deleteUser(id) {
  try {
    const response = await fetch(
      `${API_URL}/${id}`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${authToken}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to delete user"
      );
    }

    console.log(
      "User deleted:",
      data
    );

    await getUsers();
  } catch (error) {
    console.error(
      "Delete user error:",
      error
    );
  }
}


getUsers();