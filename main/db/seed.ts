import { getDatabase } from './database';
import { createProfile } from './profilesDao';

/**
 * Seed default profile if none exists.
 */
export function seedDefaultProfile(): void {
  const db = getDatabase();
  const existingDefault = db.prepare('SELECT profile_id FROM profiles WHERE is_default = 1 AND archived_at IS NULL').get();

  if (existingDefault) {
    return; // Default profile already exists
  }

  // Create a default profile with placeholder content
  // In a real app, this would come from a file or user input
  createProfile({
    name: 'Default Profile',
    rules_text: `# Resume Generation Rules

## Personal Information
- First Name: Tan
- Keep personal information consistent across all resumes

## Summary Section
- Start with: "Experienced software engineer with..."
- Keep to 3-4 sentences
- Highlight relevant experience for the role

## Skills Section
- Organize skills by category (Programming Languages, Frameworks, Tools)
- List 15-20 relevant skills
- Match skills to job requirements

## Professional Experience
- Include 3-5 most relevant positions
- Use 4-6 bullet points per position
- Start bullets with action verbs
- Quantify achievements where possible
- Use <strong> tags sparingly (max 1 per bullet) for key achievements

## Education
- Include degree, institution, graduation year

## Certificates
- List relevant certifications
`,
    base_resume_text: '',
    template_html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{{owner_first_name}}</title>
    <style>
      body {
        font-family: Rubik;
        margin: 45px 25px;
        line-height: 1.2;
        font-size: 11pt;
      }
      h1 {
        color: darkgreen;
        font-size: 24pt;
        margin-bottom: 15px;
      }
      h2 {
        font-size: 14pt;
        margin-top: 0px;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
      }
      h3 {
        font-size: 12pt;
        margin-bottom: 2px;
        margin-top: 0px;
        color: darkred;
      }
      .company-info {
        color: darkblue;
      }
      .company-info::before {
        content: " @";
      }
      .contact {
        font-size: 11pt;
        margin-top: 4px;
        margin-bottom: 20px;
      }
      ul {  
        margin-top: 4px;
        margin-bottom: 12px;
        padding-left: 0px;
        margin-left: 20px;
      }
      li {
        position: relative;
        margin-bottom: 2px;
        text-align: justify;
        padding-left: 0px;
      }
      .company-role {
        font-weight: bold;
      }
      p {
        text-align: justify;
        font-size: 12pt;
      }
    </style>
  </head>
  <body>
    <h1>{{owner_first_name}} Resume</h1>
    <h3>{{headline}}</h3>
    <div class="contact">{phone number} • {email} • {github} • {address}</div>

    <h2>Summary</h2>
    <p>{{summary}}</p>

    <h2>Skills</h2>
    <ul>
      <li>
        {category}: {skill 1}, {skill 2}, {skill 3}, ...
      </li>
      <li>
        {category}: {skill 1}, {skill 2}, {skill 3}, ...
      </li>
      <li>
        {category}: {skill 1}, {skill 2}, {skill 3}, ...
      </li>
      ...
    </ul>

    <h2>Professional Experience</h2>    
    <h3>{role}<span class="company-info">{company name}</span></h3>
    <div>{company address} | {duration}</div>
    <ul>
      <li>{experiene}</li>
      <li>{experiene}</li>
      ...
    </ul>
    <div>{company address} | {duration}</div>
    <ul>
      <li>{experiene}</li>
      <li>{experiene}</li>
      ...
    </ul>
    ...

    <h2>Freelancing & Client Projects</h2>
    <div>{project name} - {project description}</div>
    <ul>
      <li>{experiene}</li>
      <li>{experiene}</li>
      ...
    </ul>
    <div>{project name} - {project description}</div>
    <ul>
      <li>{experiene}</li>
      <li>{experiene}</li>
      ...
    </ul>
    ...

    <h2>Education</h2>
    {{education}}

    <section>
      <h2>Certificates</h2>
      <ul>
        <li><a href="https://www.freecodecamp.org/certification/thaitan_tran/javascript-v9">freeCodeCamp — JavaScript Certification</a></li>
        <li><a href="https://www.freecodecamp.org/certification/thaitan_tran/python-v9">freeCodeCamp — Python Certification</a></li>
        <li><a href="https://www.hackerrank.com/certificates/80c0a23d9ae1">HackerRank — JavaScript Certificate</a></li>
        <li><a href="https://www.hackerrank.com/certificates/d48819686fdf">HackerRank — Java Certificate</a></li>
        <li><a href="https://www.hackerrank.com/certificates/654b8f310a80">HackerRank — React Certificate</a></li>
        <li><a href="https://www.hackerrank.com/certificates/f29077eb188e">HackerRank — Node.js Certificate</a></li>
        <li><a href="https://udemy-certificate.s3.amazonaws.com/image/UC-14ac5048-f12d-4836-91f2-840647f5f92a.jpg">Udemy — The Complete React Native + Hooks Course</a></li>
        <li><a href="https://udemy-certificate.s3.amazonaws.com/image/UC-20512163-5d61-4c9e-83ed-df4b0ee23c05.jpg">Udemy — The Complete Flutter Development Bootcamp with Dart</a></li>
        <li><a href="https://udemy-certificate.s3.amazonaws.com/image/UC-6854d8fc-4536-413b-9deb-4d1f1bda6384.jpg">Udemy — The Complete Flutter UI Masterclass | iOS, Android, & Web</a></li>
        <li><a href="https://udemy-certificate.s3.amazonaws.com/image/UC-07a39776-c845-412d-bf29-4acefa3e25f7.jpg">Udemy — The Complete Android Oreo Developer Course</a></li>
      </ul>
    </section>
  </body>
</html>`,
    is_default: true,
  });
}
