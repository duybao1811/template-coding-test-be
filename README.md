# 🚀 Template Coding Test - Backend (NestJS)

## 🌐 Live Demo

👉 https://template-coding-test-be-production.up.railway.app/api/v1

------------------------------------------------------------------------

## 📌 Overview

This project is a backend service built with **NestJS** that provides
chat APIs integrated with OpenAI.\
It supports conversation history, session-based chat, and
production-ready configurations.

------------------------------------------------------------------------

## ⚙️ Tech Stack

-   NestJS (Node.js)
-   TypeScript
-   MySQL (TypeORM)
-   OpenAI API

------------------------------------------------------------------------

## ✨ Features

-   Chat API with AI response
-   Store conversation history in database
-   Session-based chat using `session_id`
-   Streaming response (real-time)
-   Rate limiting
-   CORS configuration

------------------------------------------------------------------------

## 🛠️ Setup & Run

### 1. Install dependencies

``` bash
npm install
```

### 2. Setup environment variables

``` bash
cp .env.example .env
```

Update `.env`:

``` env
PORT=3001
APP_BASE_URL=http://localhost:3001

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_NAME=chat_app
DB_SYNC=true
DB_SSL=false

CORS_ORIGIN=http://localhost:3000,http://localhost:3001

OPENAI_MODEL=gpt-5.4
OPENAI_API_KEY=your_openai_api_key
```

### 3. Run application

``` bash
npm run start:dev
npm run build
npm run start:prod
```

Server: http://localhost:3001/api/v1

------------------------------------------------------------------------

## 🔧 Environment Variables Explanation

### 🌐 Server

-   PORT: Port where server runs
-   APP_BASE_URL: Base URL for building full links (images, files)

### 🗄️ Database

-   DB_HOST: Database host
-   DB_PORT: Database port
-   DB_USERNAME: Username
-   DB_PASSWORD: Password
-   DB_NAME: Database name
-   DB_SYNC: Auto sync schema (dev only)
-   DB_SSL: Enable SSL

### 🔐 OpenAI

-   OPENAI_MODEL: Model name
-   OPENAI_API_KEY: API key for OpenAI

### 🌍 CORS

-   CORS_ORIGIN: Allowed frontend domains

------------------------------------------------------------------------

## 🗄️ Database

-   Using MySQL
-   Auto create tables if DB_SYNC=true

------------------------------------------------------------------------

## 🔐 Notes
-   Ensure MySQL is running
