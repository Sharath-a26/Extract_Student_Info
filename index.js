const express = require('express');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const {GoogleGenerativeAI} = require('@google/generative-ai')
const app = express();

const PORT = process.env.PORT || 80;

const genAI = new GoogleGenerativeAI('AIzaSyCcvPfgez4w6J7Ze9--BROhrxD3TtTJObU');


//configure storage - so if a file is uploaded to this storage the endpoint gets triggered
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'resume' + ext);
    }
})


const upload = multer({storage});

async function getGitHubRepoData(username) {
  const res = await axios.get(`https://api.github.com/users/${username}/repos`);
  return res.data.map(repo => ({
    name: repo.name,
    description: repo.description || "No description provided.",
    language: repo.language,
    stars: repo.stargazers_count
  }));
}

async function generateSummaryWithGemini(repos) {
  const prompt = 
  `
  
      You're analyzing a GitHub profile. Based on the following repositories, generate:
  - A summary of the user's key programming skills
  - Notable or interesting projects
  - Likely areas of interest

  Give the result in a structured format. Use bullet points for clarity.

  Repositories:
      ${repos.map(r => `- ${r.name}: ${r.description} (Language: ${r.language}, ⭐ Stars: ${r.stars})`).join('\n')}
      `;
  
  const model = genAI.getGenerativeModel({model:'gemini-1.5-flash'})
  const result = await model.generateContent(prompt)
  const response = await result.response
  return response.text()
}

async function run(username) {
  const repos = await getGitHubRepoData(username);
  const summary = await generateSummaryWithGemini(repos);
  
  
  console.log("📄 GitHub Profile Summary:\n", summary);
  return summary
}


// Middleware to parse JSON
app.use(express.json());


//endpoint for uploading resume
app.post('/get_student_details',upload.single('resume'),async (req,res)=>{
    if (!req.file) return res.status(400).send('No file Uploaded');

    //parsing student's github link and getting student details like interests, skills, etc.
    
    const github_url = req.body.github_url;
    const username = github_url.split('/').pop();

    const github_summary = await run(username)
    //parsing resume and getting student details
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path),{
        filename: req.file.originalname,
        contentType: 'application/pdf'
      });

    const fileStream = fs.createReadStream(req.file.path)

    axios.post('https://api.apilayer.com/resume_parser/upload', fileStream, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'apikey': 'isS3RxuiGnx6RaNVwioHZEMrzspvPj8M'
        }
    }).then(response => {
        console.log('✅ Parsed Resume:', response.data);
        res.send({'Parsed Resume':response.data, 'GitHub Summary':github_summary});
      })
      .catch(error => {
        console.error('❌ Error:', error.response?.data || error.message);
      });
    //send request to resume parser

    

    
})

// Sample GET route
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Sample POST route
app.post('/greet', (req, res) => {
  const { name } = req.body;
  res.send(`Hello, ${name || 'Stranger'}!`);
});




// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
