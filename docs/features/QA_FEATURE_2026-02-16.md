# QA Feature Implementation Plan

**Status**: ✅ Completed  
**Created**: 2026-02-16  
**Completed**: 2026-02-16  
**Version**: 0.2.0  
**Feature**: Questions & Answers PDF Generation

## Overview
This document provides a complete implementation plan for the QA (Questions & Answers) feature. It includes requirements analysis, improvements, missing points identification, and a detailed step-by-step implementation guide.

The QA feature allows users to optionally provide questions when generating resumes. The LLM will generate answers based on the resume and job description, and a QA PDF will be created alongside the resume and cover letter PDFs.

## Feature Requirements (from TODO)

### Current Requirements:
1. **Generate Screen**: Optional questions input section (similar to job URL)
2. **Conditional PDF Generation**: Generate QA PDF only if questions are provided
3. **Rules Integration**: Profile rules_text should specify how to answer questions
4. **Data Structure**: QA array at same level as `cover_letter` and `resume` in CallBOutput:
   ```json
   {
     "resume": {...},
     "qa": [
       {"question": "string", "answer": "string"}
     ],
     "cover_letter": {...}
   }
   ```
5. **History Screen**: Option to open QA PDF only when it exists

### Important Implementation Note:
**Questions must be appended to Call B input when calling OpenAI API**
- When questions are provided, they must be included in the user content sent to OpenAI
- Questions should be added to the INPUTS section in `buildCallBMessages()`
- This ensures the LLM receives the questions and can generate appropriate answers in the QA array

---

## Improvements & Enhancements

### 1. **Questions Input UX**
**Current Plan**: Simple textarea (like job URL)
**Improvements**:
- **Multi-line textarea** with placeholder: "Enter questions (one per line or separated by newlines)"
- **Question counter**: Show "X questions entered"
- **Validation**: Warn if questions are empty but user tries to generate
- **Persistence**: Save questions to localStorage (like JD text and URL)
- **Clear button**: Quick way to clear questions

### 2. **Question Parsing & Formatting**
**Missing Point**: How to parse questions from user input?
**Recommendation**:
- Support multiple formats:
  - One question per line (newline-separated)
  - Numbered list (1., 2., etc.)
  - Bullet points (-, •, etc.)
- Auto-detect and normalize to array of strings
- Show preview of parsed questions before generation

### 3. **Rules Text Integration**
**Current Plan**: Rules specify how to answer questions
**Improvements**:
- **Template section in rules**: Provide example QA schema in default profile
- **Validation guidance**: Rules should specify:
  - Answer format (concise, detailed, bullet points)
  - Reference sources (resume, JD, or both)
  - Tone/style requirements
- **Example rules snippet**:
  ```
  When questions are provided, generate a "qa" array with:
  - Each answer should reference specific experiences from the resume
  - Answers should be 2-4 sentences, tailored to the job description
  - Use STAR method (Situation, Task, Action, Result) when applicable
  ```

### 4. **QA PDF Formatting**
**Approach**: Simple Q&A format (no fancy layout)
- **Format**: Question followed by answer, repeated for each Q&A pair
- **Styling**: Basic readable format (similar to cover letter simplicity)
- **Filename**: `{FirstName}_QA.pdf` (consistent with resume/cover naming)

### 5. **Database Schema**
**Required Changes**:
- Add `qa_pdf_path TEXT NULL` to `generations` table
- **Migration**: Create migration 2 to add column
- **Backfill**: NOT NEEDED - SQLite automatically sets NULL for existing rows when adding nullable column
- Update `Generation` type in `shared/types.ts`

### 6. **Error Handling**
**Missing Points**:
- What if LLM doesn't return QA array when questions provided?
- What if questions provided but rules don't specify QA format?
- What if QA generation fails but resume/cover succeed?

**Recommendations**:
- **Validation**: Check if questions provided → QA must exist in CallBOutput
- **Partial success**: Allow generation to succeed even if QA fails (with warning)
- **Error codes**: Add `QA_GENERATION_FAILED`, `QA_VALIDATION_FAILED`
- **User feedback**: Show warning if QA expected but missing

### 7. **History Screen Enhancements**
**Current Plan**: Show "Open QA PDF" button when exists
**Improvements**:
- **Visual indicator**: Badge/icon showing QA available
- **Preview**: Show first question in history item
- **Count**: Display "X questions answered" in metadata
- **Consistent UI**: Match existing "Open Resume PDF" / "Open Cover PDF" buttons

### 8. **Backward Compatibility**
**Critical**: Ensure existing generations without QA still work
**Requirements**:
- QA is optional everywhere (nullable in DB, optional in types)
- Existing code paths work without QA
- No breaking changes to existing API contracts

---

## Missing Points & Implementation Gaps

### 1. **Type Definitions**
**Missing**:
- QA type in `CallBOutput`
- Questions parameter in generation pipeline
- QA PDF path in return types

**Files to Update**:
- `shared/types.ts`: Add `qa?: Array<{question: string; answer: string}>` to `CallBOutput`
- `shared/types.ts`: Add `qa_pdf_path: string | null` to `Generation`
- `main/generation/pipeline.ts`: Add `questions?: string[]` parameter

### 2. **Prompt Engineering**
**Critical**: Questions MUST be appended to Call B input when provided
**Required**:
- Modify `buildCallBMessages()` in `main/llm/callBPrompt.ts` to accept `questions?: string[]` parameter
- **Append questions to user content** in the INPUTS section when questions are provided:
  ```typescript
  const userContent = `
    ${rulesText}

    ---
    INPUTS (use these to generate the JSON output)

    Job (from Call A extraction):
    ${JSON.stringify(jobInput, null, 2)}

    Raw job description (excerpt):
    ${jdText.substring(0, 8000)}
    
    ${questions && questions.length > 0 ? `
    Questions to answer:
    ${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
    ` : ''}

    ---
    Generate the JSON output now. Return only the JSON object. Use the exact schema and keys defined in the rules above (this may be meta/resume/cover_letter/qa/validation_targets or another structure per profile).
  `;
  ```
- Update `runResumePayload()` in `main/llm/openaiAdapter.ts` to accept and pass questions parameter
- Rules prompt should mention QA schema when questions are provided

### 3. **PDF Generation**
**Missing**: QA PDF renderer
**Required**:
- Create `main/pdf/qaHtml.ts` (similar to `coverLetterHtml.ts`)
- Function: `buildQAHtml(qa: Array<{question: string; answer: string}>)` - simple format, no fancy layout
- Integrate into pipeline after cover letter PDF

### 4. **File Path Generation**
**Missing**: QA PDF path generation
**Required**:
- Update `generateOutputFilePaths()` in `main/fs/filesystem.ts`
- Add `qaPdfPath` to return type
- Use naming: `{ownerFirstName}_QA.pdf`

### 5. **Database Migration**
**Missing**: Schema update for existing databases
**Required**:
- New migration function in `main/db/migrations.ts`
- Add `qa_pdf_path TEXT NULL` column
- Update `generationsDao.ts` to handle new field

### 6. **Validation**
**Missing**: QA validation logic
**Required**:
- Update `validateCallBOutput()` in `main/validation/validator.ts`
- If questions provided → QA array must exist and be non-empty
- Validate QA structure (question/answer strings)

### 7. **API Contracts**
**Missing**: Electron IPC updates
**Required**:
- Update `generationRunFull` handler in `main/index.ts`
- Add `questions?: string[]` parameter
- Return `qaPdfPath` in response
- Update `renderer/types/electron.d.ts` and `main/preload.ts`

### 8. **UI State Management**
**Missing**: Questions state in GenerateScreen
**Required**:
- Add `questions` state (with localStorage persistence)
- Textarea component for questions input
- Pass questions to generation API
- Display QA PDF button in results

### 9. **Progress Indicators**
**Missing**: Progress step for QA PDF generation
**Required**:
- Add progress message: "Rendering QA PDF..." (if questions provided)
- Update progress percentage calculation

### 10. **Testing Considerations**
**Missing**: Test coverage
**Required**:
- Unit tests for QA parsing
- Integration tests for QA generation flow
- Edge cases: empty questions, malformed QA response, partial failures

---

## Implementation Checklist

### Phase 1: Foundation (Types & Schema)
- [ ] Add QA types to `shared/types.ts`
- [ ] Create database migration 2 for `qa_pdf_path` (no backfill needed - nullable column)
- [ ] Update `Generation` type and DAO
- [ ] Update `CallBOutput` type

### Phase 2: Backend - LLM Integration
- [ ] Update `buildCallBMessages()` to accept `questions?: string[]` parameter
- [ ] Append questions to Call B user content in INPUTS section when questions provided
- [ ] Update `runResumePayload()` to accept `questions?: string[]` parameter and pass to `buildCallBMessages()`
- [ ] Update `runFullGeneration()` pipeline to accept and pass questions to `runResumePayload()`
- [ ] Update validation to check QA array exists when questions provided

### Phase 3: Backend - PDF Generation
- [ ] Create `buildQAHtml()` function
- [ ] Update `generateOutputFilePaths()` for QA PDF
- [ ] Integrate QA PDF generation into pipeline
- [ ] Update `updateGenerationPaths()` to save QA PDF path

### Phase 4: Backend - API Layer
- [ ] Update `runFullGeneration()` to accept `questions?: string[]` parameter
- [ ] Update Electron IPC handler `generation:runFull` to accept questions
- [ ] Update `main/preload.ts` and `renderer/types/electron.d.ts` type definitions

### Phase 5: Frontend - Generate Screen
- [ ] Add questions textarea input (optional, similar to job URL)
- [ ] Add localStorage persistence for questions (like JD text and URL)
- [ ] Add question counter/preview (optional enhancement)
- [ ] Update `handleGenerate()` to pass questions to API
- [ ] Add "Open QA PDF" button in results section (conditional on existence)

### Phase 6: Frontend - History Screen
- [ ] Add QA PDF button (conditional on existence)
- [ ] Update history item display
- [ ] Add visual indicators for QA availability

### Phase 7: Testing & Polish
- [ ] Test with questions provided (QA PDF generated)
- [ ] Test without questions (backward compatibility - no QA PDF)
- [ ] Test error cases (QA generation fails but resume/cover succeed)
- [ ] Test database migration (existing generations have NULL qa_pdf_path)
- [ ] Update README/documentation if needed

---

## Database Migration & Backfill

### Migration Strategy
**Migration 2**: Add `qa_pdf_path TEXT NULL` column to `generations` table

**Backfill Logic**: **NOT NEEDED**
- SQLite's `ALTER TABLE ADD COLUMN` with a nullable column automatically sets `NULL` for all existing rows
- No data migration required
- Existing generations will have `qa_pdf_path = NULL` (which is correct - they don't have QA PDFs)

**Migration Code Pattern**:
```typescript
function migration2_addQaPdfPath(db: Database.Database): void {
  // Check if column already exists (idempotent migration)
  const tableInfo = db.prepare("PRAGMA table_info(generations)").all();
  const hasQaPdfPath = tableInfo.some((col: any) => col.name === 'qa_pdf_path');
  
  if (!hasQaPdfPath) {
    db.exec(`ALTER TABLE generations ADD COLUMN qa_pdf_path TEXT NULL`);
  }
  
  db.pragma(`user_version = 2`);
}
```

**Why No Backfill?**
- `qa_pdf_path` is nullable (optional)
- Existing generations legitimately don't have QA PDFs
- NULL is the correct value for pre-QA feature generations
- No need to generate PDFs retroactively

## Backward Compatibility Strategy

### Key Principles:
1. **QA is always optional** - Never required for generation to succeed
2. **Graceful degradation** - If QA generation fails, resume/cover still succeed
3. **Null-safe everywhere** - All QA-related code checks for existence
4. **Database nullable** - `qa_pdf_path` is NULL for existing/legacy records

### Migration Path:
1. Add column as nullable (no data loss, no backfill needed)
2. Existing generations remain valid (qa_pdf_path = NULL)
3. New generations populate qa_pdf_path when questions provided
4. UI conditionally shows QA button based on path existence

---

## Risk Assessment

### Low Risk:
- ✅ Adding optional fields to types
- ✅ Adding nullable database column
- ✅ UI additions (optional fields)

### Medium Risk:
- ⚠️ LLM prompt changes (may affect existing generations)
- ⚠️ Validation logic changes
- ⚠️ PDF generation integration

### Mitigation Strategies:
- Test thoroughly with existing profiles
- Keep QA generation isolated (separate try/catch)
- Provide clear error messages if QA fails
- Ensure backward compatibility (QA is always optional)

---

## Future Enhancements (Post-MVP)

1. **Question Templates**: Pre-defined question sets for common job types
2. **Question Import**: Import questions from job application forms
3. **Answer Editing**: Allow manual editing of generated answers before PDF
4. **Multiple QA Sets**: Support different question sets per generation
5. **QA Analytics**: Track which questions are asked most frequently
6. **Answer Quality Scoring**: Rate answer completeness/relevance

---

## Questions to Resolve (Future Considerations)

1. **Question Format**: Should we support markdown formatting in questions? (MVP: Plain text)
2. **Answer Length**: Should there be a character/word limit per answer? (MVP: Let LLM decide)
3. **Question Ordering**: Preserve user order or allow LLM to reorder? (MVP: Preserve order)
4. **Partial Answers**: What if LLM doesn't answer all questions? (MVP: Validation error)
5. **Question Validation**: Should we validate question format before sending to LLM? (MVP: Basic non-empty check)

---

## Implementation Summary

This document provides a complete implementation plan for the QA feature. Key points:

### Core Requirements:
- ✅ Optional questions input on Generate screen (similar to job URL)
- ✅ Questions appended to Call B API input when provided
- ✅ QA array in CallBOutput JSON structure: `qa: [{question: string, answer: string}]`
- ✅ Conditional QA PDF generation (only when questions provided)
- ✅ QA PDF button on History screen (only when QA PDF exists)

### Technical Approach:
- **Database**: Add nullable `qa_pdf_path` column via migration (no backfill needed)
- **LLM Integration**: Append questions to Call B prompt in INPUTS section
- **PDF Generation**: Simple Q&A format (question followed by answer, no fancy layout)
- **Backward Compatibility**: All QA features are optional, existing functionality preserved

### Implementation Phases:
1. **Foundation**: Types & database schema
2. **Backend LLM**: Prompt integration with questions
3. **Backend PDF**: QA PDF generation
4. **API Layer**: Electron IPC updates
5. **Frontend Generate**: Questions input UI
6. **Frontend History**: QA PDF button
7. **Testing**: Comprehensive testing & polish

### Key Files to Modify:
- `shared/types.ts` - Add QA types
- `main/db/migrations.ts` - Migration 2 for qa_pdf_path
- `main/llm/callBPrompt.ts` - Append questions to prompt
- `main/llm/openaiAdapter.ts` - Accept questions parameter
- `main/generation/pipeline.ts` - Pass questions through pipeline
- `main/pdf/qaHtml.ts` - NEW: QA PDF HTML builder
- `main/fs/filesystem.ts` - Add qaPdfPath generation
- `renderer/screens/GenerateScreen.tsx` - Questions input
- `renderer/screens/HistoryScreen.tsx` - QA PDF button

Following this plan ensures a robust implementation that doesn't break existing functionality while adding valuable new capabilities.
