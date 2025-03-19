import {makeJob} from "./tool";
import {migrateBadges} from "./migrations/migrateBadges";

const MIGRATIONS = {
    "2025-02-05-badges": migrateBadges,
}

const job = makeJob('Migration', async (ctx) => {
    const migrationName = process.argv[2];

    if (!migrationName || !MIGRATIONS[migrationName]) {
        console.error('No migration name provided. Valid names are:', Object.keys(MIGRATIONS).join(', '));

        throw new Error('No migration name provided');
    }

    console.log(`Running migration ${migrationName}...`);

    const migration = MIGRATIONS[migrationName];

    await migration(ctx);

    console.log(`Migration ${migrationName} done.`);
});

job();

export {};