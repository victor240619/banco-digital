package com.bravus.bank.compliance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/analysis")
@PreAuthorize("hasRole('ADMIN')")
public class DocumentAnalysisController {
    private final DocumentAnalysisService analysisService;

    public DocumentAnalysisController(DocumentAnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping("/document")
    public ResponseEntity<DocumentAnalysisEntity> analyze(@Valid @RequestBody AnalyzeRequest request,
                                                         Authentication auth) {
        DocumentAnalysisService.AnalysisCommand cmd = new DocumentAnalysisService.AnalysisCommand();
        cmd.type = request.type();
        cmd.document = request.document();
        return ResponseEntity.ok(analysisService.analyze(cmd, auth.getName()));
    }

    @GetMapping("/document")
    public ResponseEntity<List<DocumentAnalysisEntity>> recent(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(analysisService.recent(limit));
    }

    public record AnalyzeRequest(String type, @NotBlank String document) {}
}
