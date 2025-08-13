# Orion Vault Backend API Specification

This document outlines the API contract that the Orion Vault frontend expects. Any backend implementation must adhere to these endpoint specifications to be compatible.

## General Principles

-   **Authentication:** Endpoints under `/auth` are public. All other data-related endpoints require a `Bearer <token>` in the `Authorization` header, obtained from the `/auth/login` endpoint.
-   **Data Format:** All request and response bodies are in JSON format.
-   **Security:** The backend is "zero-knowledge." It should never store the user's master password. It only stores the Argon2id salt and the user's data key, which itself is encrypted with a key derived from the master password. The backend identifies the user for all data operations based on the JWT or Bearer token provided in the `Authorization` header. This token should contain the necessary user context (e.g., a `userId`).
-   **Error Handling:** Failed requests should return an appropriate HTTP status code (e.g., 400, 401, 404, 500) and a JSON body with an error message: `{ "message": "Error description" }`.

---

## Data Models

### User

Represents a user account's stored properties.

```json
{
  "id": 1,
  "email": "user@example.com",
  "salt": "base64_encoded_string",
  "public_key": {}, // This is a legacy field, can be an empty JSON object.
  "encrypted_private_key": "base64_encoded_string" // This is the user's main data key, wrapped with their master password key.
}
```

### Vault

Represents a container for items.

```json
{
  "id": 1,
  "name": "Personal",
  "icon": "folder"
}
```

### Item (Server Representation)

Represents an encrypted item as stored on the server. `encrypted_data` and `nonce` are Base64 encoded.

```json
{
    "id": 101,
    "UUID_Identifier": "a8c5e6f0-1b2a-4c3d-8e4f-9a0b1c2d3e4f",
    "vault_id": 1,
    "user_id": 1,
    "created_at": 1672531200000,
    "updated_at": 1672531200000,
    "encrypted_data": "base64_encoded_string",
    "nonce": "base64_encoded_string"
}
```

---

## Auth Endpoints

Base Path: `/api/auth`

### 1. Register a New User

-   **Endpoint:** `POST /signup`
-   **Description:** Creates a new user account.
-   **Request Body:**

    ```json
    {
      "email": "user@example.com",
      "salt": "base64_encoded_string",
      "keys": {}, // Legacy public_key field
      "encrypted_private_key": "base64_encoded_string"
    }
    ```

-   **Success Response:**
    -   **Code:** `201 Created`
    -   **Body:** The created User object.

-   **Error Responses:**
    -   `409 Conflict`: If the email already exists.

### 2. Log In a User

-   **Endpoint:** `POST /login`
-   **Description:** Authenticates a user and returns a session token along with all their data.
-   **Request Body:**

    ```json
    {
      "email": "user@example.com"
    }
    ```
    *Note: The master password is not sent. The client uses it to derive a key and will fail if the password is wrong.*

-   **Success Response:**
    -   **Code:** `200 OK`
    -   **Body:**

        ```json
        {
          "token": "jwt_or_opaque_session_token",
          "user": {
            "id": 1,
            "email": "user@example.com",
            "salt": "base64_encoded_string",
            "public_key": {},
            "encrypted_private_key": "base64_encoded_string"
          },
          "items": [
            // Array of Item objects (server representation)
          ],
          "vaults": [
            // Array of Vault objects
          ]
        }
        ```

-   **Error Responses:**
    -   `404 Not Found`: If the user does not exist.

---

## Data Endpoints

Base Path: `/api/data`
Requires `Authorization: Bearer <token>` header.

### 3. Get All Items

-   **Endpoint:** `GET /item`
-   **Description:** Fetches all encrypted items for the authenticated user.
-   **Success Response:**
    -   **Code:** `200 OK`
    -   **Body:** An array of Item objects (server representation).

### 4. Create an Item

-   **Endpoint:** `POST /item`
-   **Description:** Creates a new encrypted item.
-   **Request Body:**

    ```json
    {
        "UUID_Identifier": "generated_uuid_string",
        "created_at": 1672531200000,
        "updated_at": 1672531200000,
        "encrypted_data": "base64_encoded_string",
        "nonce": "base64_encoded_string",
        "user_id": 1,
        "vault_id": 1
    }
    ```

-   **Success Response:**
    -   **Code:** `201 Created`
    -   **Body:** The newly created Item object (server representation).

### 5. Update an Item

-   **Endpoint:** `PATCH /item/{id}`
-   **Description:** Updates an existing encrypted item, identified by its numeric `id`.
-   **Request Body:**

    ```json
    {
        "UUID_Identifier": "uuid_string_of_item_to_update",
        "vault_id": 2, // Example: moving the item to a new vault
        "user_id": 1,
        "updated_at": 1672531200000,
        "encrypted_data": "base64_encoded_string",
        "nonce": "base64_encoded_string"
    }
    ```

-   **Success Response:**
    -   **Code:** `200 OK`
    -   **Body:** The updated Item object (server representation).

### 6. Delete an Item

-   **Endpoint:** `DELETE /item/{id}`
-   **Description:** Deletes an item, identified by its numeric `id`.
-   **Request Body:**

    ```json
    {
      "UUID_Identifier": "uuid_string_of_item_to_delete"
    }
    ```

-   **Success Response:**
    -   **Code:** `204 No Content`

### 7. Get All Vaults

-   **Endpoint:** `GET /vault`
-   **Description:** Fetches all vaults for the authenticated user.
-   **Success Response:**
    -   **Code:** `200 OK`
    -   **Body:** An array of Vault objects.

### 8. Create a Vault

-   **Endpoint:** `POST /vault`
-   **Description:** Creates a new vault.
-   **Request Body:**

    ```json
    {
      "name": "Work",
      "icon": "briefcase"
    }
    ```

-   **Success Response:**
    -   **Code:** `201 Created`
    -   **Body:** The newly created Vault object.

### 9. Update a Vault

-   **Endpoint:** `PATCH /vault/{id}`
-   **Description:** Updates a vault's name and/or icon.
-   **Request Body:**

    ```json
    {
      "name": "Work Stuff",
      "icon": "server",
      "vault_id": 2
    }
    ```

-   **Success Response:**
    -   **Code:** `200 OK`
    -   **Body:** The updated Vault object.

### 10. Delete a Vault

-   **Endpoint:** `DELETE /vault/{id}`
-   **Description:** Deletes an empty vault.
-   **Request Body:**

    ```json
    {
      "vault_id": 2
    }
    ```
-   **Success Response:**
    -   **Code:** `204 No Content`
-   **Error Response:**
    -   `409 Conflict`: If the vault is not empty.