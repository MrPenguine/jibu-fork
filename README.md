## Shared Libraries

### Queue Definitions

The `@jibu/queue-definitions` library provides shared queue and job definitions that can be used by both the backend API and worker applications.

#### Usage

Import the constants and interfaces from the library:

```typescript
import { 
  QUEUE_NAMES, 
  JOB_NAMES,
  DefaultJobData,
  EmailJobData,
  IndexFileSourceJobData,
  DeindexSourceJobData
} from '@jibu/queue-definitions';
```

When adding a new job type:

1. Add the queue name to `QUEUE_NAMES` if needed
2. Add the job name to `JOB_NAMES`
3. Add a job data interface
4. Register the processor in the worker application

#### Building

To rebuild the library after changes:

```bash
npx tsc -p libs/queue-definitions/tsconfig.json
```

### Using Queues in Backend Modules

To use queue functionality in a backend module:

1. Import the QueueModule in your feature module:

```typescript
import { Module } from '@nestjs/common';
import { QueueModule } from '../../core/queue/queue.module';

@Module({
  imports: [QueueModule],
  // other module configuration
})
export class YourFeatureModule {}
```

2. Inject the QueueService in your service:

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '../../core/queue/queue.service';
import { IndexFileSourceJobData } from '@jibu/queue-definitions';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly queueService: QueueService) {}

  async createKnowledgeBaseSource(/* params */) {
    // Create source logic...

    // Then add indexing job
    await this.queueService.addIndexKnowledgeBaseSourceJob({
      knowledgeBaseSourceId: createdSource.id,
      organizationId: createdSource.organizationId,
    });
  }
}
```

The worker application runs as a separate process and will process the jobs added to the queues. When you start services using the `start-services.bat` script, the worker will be started in its own terminal window automatically.

## Using the Queue System

The application uses a Redis-based queue system to handle background tasks like knowledge base indexing.

### Starting the Worker

The worker application runs as a separate process and processes jobs from Redis queues. The worker is a simple Node.js script that directly connects to Redis to monitor and process jobs.

When you run the `start-services.bat` script, the worker is automatically started alongside Docker and Cloudflared. You can also start it manually:

```bash
# Run directly with Node
node apps/worker/queue-runner.js

# Or using NX
npx nx serve worker
```

The worker will display a heartbeat message every 20 seconds to confirm it's running and actively monitoring the queues.

### Adding Jobs to Queues in Backend Code

To add a job to a queue after creating a knowledge base or performing other operations:

1. Import the QueueModule in your feature module:

```typescript
import { Module } from '@nestjs/common';
import { QueueModule } from '../../core/queue/queue.module';

@Module({
  imports: [QueueModule],
  // other module configuration
})
export class KnowledgeBaseModule {}
```

2. Inject the QueueService in your service:

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '../../core/queue/queue.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly queueService: QueueService) {}

  async createKnowledgeBaseSource(data) {
    // Create source in database...
    const source = await this.prisma.knowledgeBaseSource.create({...});

    // Then add indexing job to queue
    await this.queueService.addIndexKnowledgeBaseSourceJob({
      knowledgeBaseSourceId: source.id,
      organizationId: source.organizationId
    });
    
    return source;
  }
}
```

### How It Works

1. The queue system uses Redis to store jobs
2. The worker script directly connects to Redis and polls for new jobs
3. Job types and data formats are defined in both the backend and the worker
4. When you add a job using the backend QueueService, it's stored in Redis
5. The worker picks up the job and processes it, with appropriate handling based on job type
