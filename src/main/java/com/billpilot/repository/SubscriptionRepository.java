package com.billpilot.repository;

import com.billpilot.model.Subscription;
import com.billpilot.model.SubscriptionStatus;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SubscriptionRepository extends MongoRepository<Subscription, String> {

    @Query("{ '$or': [ { 'user': ?0 }, { 'user': ?1 } ] }")
    List<Subscription> findByUserIdOrObjectId(String userId, ObjectId objectId);

    default List<Subscription> findByUser(String userId) {
        if (userId != null && ObjectId.isValid(userId)) {
            return findByUserIdOrObjectId(userId, new ObjectId(userId));
        }
        return findByUserIdOrObjectId(userId, null);
    }

    List<Subscription> findByStatus(SubscriptionStatus status);

    List<Subscription> findByStatusAndRenewalDate(SubscriptionStatus status, LocalDate renewalDate);

    List<Subscription> findByStatusAndRenewalDateBetween(SubscriptionStatus status, LocalDate startDate, LocalDate endDate);
}
