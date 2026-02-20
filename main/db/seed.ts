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
    template_html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Resume</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 20px; }
    .section { margin-bottom: 20px; }
    ul { list-style-type: disc; margin-left: 20px; }
  </style>
</head>
<body>
  <h1>{{owner_first_name}} Resume</h1>
  
  <div class="section">
    <h2>Summary</h2>
    <p>{{summary}}</p>
  </div>
  
  <div class="section">
    <h2>Skills</h2>
    <p>{{skills}}</p>
  </div>
  
  <div class="section">
    <h2>Professional Experience</h2>
    {{experience}}
  </div>
  
  <div class="section">
    <h2>Education</h2>
    <p>{{education}}</p>
  </div>
  
  <div class="section">
    <h2>Certificates</h2>
    <p>{{certificates}}</p>
  </div>
</body>
</html>`,
    is_default: true,
  });
}
