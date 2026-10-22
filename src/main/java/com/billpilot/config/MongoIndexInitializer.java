package com.billpilot.config;

import com.billpilot.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/**
 * Makes sure user emails are unique at the database level. Without the index, two concurrent
 * sign-ups for the same address can both pass the application-level duplicate check.
 *
 * Spring Data's automatic index creation is switched off because it aborts startup when the
 * database already holds an equivalent index under a different name (for example one created by
 * an earlier version of the app). This initializer only logs a warning in that situation.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            mongoTemplate.indexOps(User.class)
                    .ensureIndex(new Index().on("email", Sort.Direction.ASC).unique().named("email_unique"));
            log.info("Unique index on users.email is in place");
        } catch (Exception e) {
            // Typically: an equivalent index already exists under another name, or existing data
            // contains duplicate emails and must be cleaned up before the index can be built.
            log.warn("Could not create the unique index on users.email ({}). "
                    + "Verify one exists, otherwise duplicate accounts are possible under concurrent sign-ups.",
                    e.getMessage());
        }
    }
}
