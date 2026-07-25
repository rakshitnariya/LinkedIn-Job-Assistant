package com.assistant.job.repository;

import com.assistant.job.model.GeneratedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, UUID> {
    List<GeneratedDocument> findAllByOrderByCreatedAtDesc();
}
