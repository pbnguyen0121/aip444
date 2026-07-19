# Lab 08 - Visual Debugger

## Overview

This project is a command-line visual debugging assistant that analyzes screenshots using a vision language model through OpenRouter. Before sending an image to the model, the program optimizes it using Sharp by resizing and converting it to JPEG format. If the screenshot contains a technical error or warning, the assistant can automatically perform a Tavily web search to gather additional information before generating the final debugging report.

---

## Features

- Read an image from the command line
- Optimize screenshots before sending them to the model
- Convert images to Base64
- Analyze screenshots with a vision language model
- Automatically decide when a web search is needed
- Search technical errors using Tavily
- Generate a final debugging report with suggested fixes

---

## Installation

Clone the repository and install the project dependencies.

```bash
npm install
```

This project uses the following packages:

- **sharp** – resizes images and converts them to JPEG before sending them to the vision model.
- **openai** – communicates with the OpenRouter API for vision analysis and tool calling.
- **@tavily/core** – performs web searches when additional information is needed.

If you are creating the project from scratch, install the required packages with:

```bash
npm install openai @tavily/core sharp dotenv
npm install --save-dev typescript tsx @types/node
```

---

## Environment Variables

Create a `.env` file with the following variables:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
TAVILY_API_KEY=your_tavily_api_key
LLM_MODEL=google/gemini-3.1-flash-lite-preview
```

---

## Running the Program

Run the application with:

```bash
npm start -- <image-path>
```

Example:

```bash
npm start -- chroma-error.png
```

---

## Image Processing

Before sending the screenshot to the vision model, the application:

- checks whether the file exists
- resizes the image to a maximum dimension of 1024 pixels
- converts the image to JPEG with quality 85
- encodes the image as Base64

This preprocessing reduces the request size while keeping enough visual detail for accurate analysis.

---

## Optimization Statistics

For every processed image, the application reports:

- Original image size
- Processed JPEG size
- Base64 string size

These statistics show how image preprocessing reduces the amount of data sent to the vision model while preserving enough information for analysis.

---

## Tool Calling

The assistant first analyzes the screenshot using the vision model.

If no technical issue is detected, it generates the debugging report directly.

If the model detects a technical error, warning, or stack trace, it automatically calls the `lookup_error` tool. This tool performs a Tavily web search and returns relevant documentation or community resources. The assistant then combines the screenshot analysis with the search results to generate the final debugging report.

---

## Testing

The application was tested with the following scenarios:

- Screenshot containing a technical error
- Screenshot without any technical issues
- Missing image file
- Unsupported file type

---

## Sample Output

```text
Image Optimization Stats
------------------------
Original image size: 1.42 MB
Processed JPEG size: 118.43 KB
Base64 string size: 157.91 KB

Model requested Tavily lookup.
Search query: Failed to connect to chromadb

Searching Tavily...

Final Debugging Report
...
```

---
