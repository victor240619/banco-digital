package com.bravus.bank.auth.recovery;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "password_reset_audit")
public class PasswordResetAuditEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private PasswordResetRequestEntity request;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(nullable = false, length = 120)
    private String actor;

    @Column(length = 500)
    private String detail;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public PasswordResetRequestEntity getRequest() { return request; }
    public void setRequest(PasswordResetRequestEntity request) { this.request = request; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
