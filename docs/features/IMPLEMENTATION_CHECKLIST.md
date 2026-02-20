# QA Feature Implementation Checklist

**Quick Reference** - Use this checklist while implementing the QA feature.

## ✅ Pre-Implementation Verification

- [x] Feature requirements documented in `QA_FEATURE_2026-02-16.md`
- [x] All key files identified
- [x] Database migration strategy confirmed (no backfill needed)
- [x] Backward compatibility strategy understood
- [x] Codebase structure understood

## 📋 Implementation Checklist

### Phase 1: Foundation (Types & Schema)
- [ ] Add `qa?: Array<{question: string; answer: string}>` to `CallBOutput` in `shared/types.ts`
- [ ] Add `qa_pdf_path: string | null` to `Generation` type in `shared/types.ts`
- [ ] Create `migration2_addQaPdfPath()` in `main/db/migrations.ts`
- [ ] Update `CURRENT_VERSION` to 2 in `main/db/migrations.ts`
- [ ] Update `runMigrations()` to call migration 2
- [ ] Update `CreateGenerationParams` in `main/db/generationsDao.ts` to include `qa_pdf_path?`
- [ ] Update `createGeneration()` INSERT statement to include `qa_pdf_path`
- [ ] Update `updateGenerationPaths()` to accept `qa_pdf_path` parameter

### Phase 2: Backend - LLM Integration
- [ ] Update `buildCallBMessages()` signature in `main/llm/callBPrompt.ts` to accept `questions?: string[]`
- [ ] Append questions to userContent in INPUTS section when provided
- [ ] Update `runResumePayload()` signature in `main/llm/openaiAdapter.ts` to accept `questions?: string[]`
- [ ] Pass questions parameter to `buildCallBMessages()`
- [ ] Update `runFullGeneration()` in `main/generation/pipeline.ts` to accept `questions?: string[]`
- [ ] Pass questions to `runResumePayload()`
- [ ] Update `validateCallBOutput()` in `main/validation/validator.ts` to check QA when questions provided

### Phase 3: Backend - PDF Generation
- [ ] Create `main/pdf/qaHtml.ts` file
- [ ] Implement `buildQAHtml(qa: Array<{question: string; answer: string}>)` function
- [ ] Use simple format: question followed by answer (similar to cover letter)
- [ ] Update `generateOutputFilePaths()` in `main/fs/filesystem.ts` to return `qaPdfPath`
- [ ] Add `qaPdfPath` generation: `{ownerFirstName}_QA.pdf`
- [ ] Integrate QA PDF generation in `runFullGeneration()` pipeline after cover letter
- [ ] Add progress message: "Rendering QA PDF..." (only if questions provided)
- [ ] Update `updateGenerationPaths()` call to include `qa_pdf_path`

### Phase 4: Backend - API Layer
- [ ] Update `runFullGeneration()` return type to include `qaPdfPath?: string | null`
- [ ] Update IPC handler `generation:runFull` in `main/index.ts` to accept `questions?: string[]`
- [ ] Pass questions to `runFullGeneration()`
- [ ] Return `qaPdfPath` in IPC response
- [ ] Update `ElectronAPI` type in `main/preload.ts` to include `questions?` parameter
- [ ] Update `ElectronAPI` interface in `renderer/types/electron.d.ts` to include `questions?` parameter

### Phase 5: Frontend - Generate Screen
- [ ] Add `questions` state in `GenerateScreen.tsx` with localStorage persistence
- [ ] Add questions textarea input (optional, similar to job URL)
- [ ] Add placeholder: "Enter questions (one per line or separated by newlines)"
- [ ] Implement question parsing: split by newlines, filter empty lines
- [ ] Add localStorage save/load for questions (like JD text and URL)
- [ ] Update `handleGenerate()` to parse questions and pass to API
- [ ] Add "Open QA PDF" button in results section (conditional on `result.qaPdfPath`)
- [ ] Update result type to include `qaPdfPath`

### Phase 6: Frontend - History Screen
- [ ] Check if `generation.qa_pdf_path` exists in history items
- [ ] Add "Open QA PDF" button (conditional on `qa_pdf_path` existence)
- [ ] Match styling with existing "Open Resume PDF" / "Open Cover PDF" buttons
- [ ] Use `window.electronAPI.filesOpenFile()` to open QA PDF

### Phase 7: Testing & Polish
- [ ] Test with questions provided → QA PDF generated
- [ ] Test without questions → No QA PDF, backward compatibility maintained
- [ ] Test database migration → Existing generations have NULL qa_pdf_path
- [ ] Test error cases → QA generation fails but resume/cover succeed
- [ ] Test question parsing → Multiple formats (newlines, numbered, bullets)
- [ ] Test validation → QA missing when questions provided → error
- [ ] Verify localStorage persistence for questions
- [ ] Check all UI elements render correctly

## 🔍 Key Implementation Details

### Question Parsing
- Split input by newlines (`\n`)
- Filter empty lines and trim whitespace
- Support numbered lists (strip "1. ", "2. ", etc.)
- Support bullet points (strip "- ", "• ", etc.)
- Return array of question strings

### Error Handling
- If questions provided but QA missing → validation error
- If QA PDF generation fails → log error but don't fail entire generation
- Use try/catch around QA PDF generation (isolated from resume/cover)

### Progress Messages
- "Rendering QA PDF..." at ~94% (after cover letter at 92%)
- Only show if questions were provided

### File Naming
- Format: `{ownerFirstName}_QA.pdf`
- Use same versioning logic as resume/cover PDFs
- Example: `Tan_QA.pdf`, `Tan_QA_v2.pdf` if exists

## 📝 Notes

- All QA features are optional - never required for generation to succeed
- Backward compatibility: existing code paths work without QA
- Database: `qa_pdf_path` is nullable, existing records have NULL
- Validation: Only validate QA when questions are actually provided
