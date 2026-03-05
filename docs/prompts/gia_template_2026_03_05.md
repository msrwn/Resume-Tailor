<html>
  <head>
    <meta charset="utf-8" />
    <title>{owner_first_name}</title>
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
        position: relative; /* add this */
        margin-bottom: 2px;
        text-align: justify;
        padding-left: 0px; /* leave space for the dash */
      }
      .company-role {
        font-weight: bold;
      }
      .category {
        font-weight: bold;
      }
      .project-name {
        color: darkblue;
        font-weight: bold;
      }
      p {
        text-align: justify;
        font-size: 12pt;
      }
    </style>
  </head>
  <body>
    <h1>{owner_full_name}</h1>
    <h3>{headline}</h3>
    <div class="contact">{phone number} • {email} • {github} • {linkedin} • {address}</div>

    <h2>Summary</h2>
    <p>{summary}</p>

    <h2>Skills</h2>
    <ul>
      <li><span class="category">{category}</span>: {skill 1}, {skill 2}, {skill 3}, ...</li>
      <li><span class="category">{category}</span>: {skill 1}, {skill 2}, {skill 3}, ...</li>
      ...
    </ul>

    <h2>Professional Experience</h2>    
    <h3>{role_title}<span class="company-info">{company_display_name}</span></h3>
    <div>{location} | {duration}</div>
    <ul>
      <li>{experiene}</li>
      <li>{experiene}</li>
      ...
    </ul>
    ...

    <h2>Education</h2>
    <ul>
      <li>{degree} - {institution} | {dates}</li>
      <li>{degree} - {institution} | {dates}</li>
      ...
    </ul>

    <h2>Languages</h2>
    <ul>
      <li>{language} - {proficiency}</li>
      <li>{language} - {proficiency}</li>
      ...
    </ul>

    <h2>Certificates</h2>
    <ul>
      <li>{certificate}</li>
      <li>{certificate}</li>
      ...
    </ul>
  </body>
</html>
