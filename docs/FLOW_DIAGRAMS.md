# Screen Cut Flow Diagrams

This document contains all the flow diagrams illustrating the data lifecycle and processes in the Screen Cut application.

## Data Lifecycle Overview

```mermaid
graph TD
    A[Start] --> B[Initialize]
    B --> C[Create]
    C --> D[Maintain]
    D --> E[Clean]
    E --> D
    D --> F[Destroy]
    
    subgraph Initialize
        B1[Check Database] --> B2[Create Tables]
        B2 --> B3[Initialize Directories]
    end
    
    subgraph Create
        C1[Detect Screenshots] --> C2[Create Records]
        C2 --> C3[Create Backups]
    end
    
    subgraph Maintain
        D1[Monitor Files] --> D2[Update Cache]
        D2 --> D3[Manage Backups]
    end
    
    subgraph Clean
        E1[Check Age] --> E2[Remove Old Files]
        E2 --> E3[Vacuum Database]
    end
```

## Screenshot Management Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant DB as Database
    participant FS as FileSystem
    
    U->>A: Take Screenshot
    A->>FS: Detect New File
    A->>DB: Create Record
    A->>FS: Create Cache
    
    alt Delete Screenshot
        U->>A: Delete Request
        A->>FS: Create Backup
        A->>DB: Update Records
        A->>FS: Remove Original
    end
```

## Cleanup Process Flow

```mermaid
stateDiagram-v2
    [*] --> CheckTime
    CheckTime --> NeedCleanup: Time Exceeded
    CheckTime --> Skip: Recent Cleanup
    
    NeedCleanup --> CleanCache
    CleanCache --> CleanBackups
    CleanBackups --> VacuumDB
    VacuumDB --> UpdateTime
    
    Skip --> [*]
    UpdateTime --> [*]
```

## Error Recovery Flow

```mermaid
flowchart LR
    A[Error Detected] --> B{Error Type}
    B -->|Database| C[Backup DB]
    B -->|FileSystem| D[Scan Files]
    
    C --> E[Create New DB]
    E --> F[Rebuild Data]
    
    D --> G[Rebuild Index]
    G --> H[Clean Orphans]
    
    F --> I[Verify]
    H --> I
    I --> J[Resume Operations]
```

## Flow Descriptions

### Data Lifecycle Overview
This diagram shows the complete lifecycle of data in the application:
- Initialization phase (database and directory setup)
- Data creation (screenshot detection and recording)
- Maintenance (ongoing file and cache management)
- Cleanup (automatic removal of old data)
- Destruction (file deletion and backup management)

### Screenshot Management Flow
This sequence diagram illustrates the interaction between:
- User actions
- Application logic
- Database operations
- File system operations

It shows both the creation and deletion flows for screenshots.

### Cleanup Process Flow
This state diagram shows the automatic cleanup process:
- Time-based triggers
- Cache cleanup
- Backup management
- Database optimization
- Status updates

### Error Recovery Flow
This flowchart shows how the system handles and recovers from errors:
- Error detection
- Different recovery paths for database and filesystem errors
- Data verification
- System restoration

## Notes

These diagrams use Mermaid syntax and can be viewed in any Markdown viewer that supports Mermaid diagrams. If you're viewing this in a plain text editor, you can copy the diagram code and paste it into the [Mermaid Live Editor](https://mermaid.live) to see the rendered version.
