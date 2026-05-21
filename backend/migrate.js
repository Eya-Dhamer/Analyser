const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/network_config_analyzer';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('Database:', mongoose.connection.name);

        const db = mongoose.connection.db;

        // Force update all Users
        console.log('\n=== Force Updating Users ===');
        const users = await db.collection('users').find({}).toArray();
        console.log(`Found ${users.length} users`);
        
        for (const user of users) {
            console.log(`Processing user ${user._id}`);
            
            // Get current document
            const currentDoc = await db.collection('users').findOne({ _id: user._id });
            console.log('Current fields:', Object.keys(currentDoc));
            
            // Build new document
            const newDoc = {
                _id: currentDoc._id,
                name: currentDoc.name,
                email: currentDoc.email,
                password: currentDoc.password,
                role: currentDoc.role || 'user',
                createdAt: currentDoc.createdAt,
                updatedAt: currentDoc.updatedAt || currentDoc.createdAt || new Date()
            };
            
            // Replace entire document
            await db.collection('users').replaceOne(
                { _id: user._id },
                newDoc
            );
            console.log(`  Replaced user document`);
        }

        // Force update all Configurations
        console.log('\n=== Force Updating Configurations ===');
        const configs = await db.collection('configurations').find({}).toArray();
        console.log(`Found ${configs.length} configurations`);
        
        for (const config of configs) {
            console.log(`Processing config ${config._id}`);
            
            const currentDoc = await db.collection('configurations').findOne({ _id: config._id });
            console.log('Current fields:', Object.keys(currentDoc));
            
            const newDoc = {
                _id: currentDoc._id,
                userId: currentDoc.userId,
                name: currentDoc.name,
                filename: currentDoc.filename || currentDoc.name || 'unnamed',
                content: currentDoc.content || currentDoc.rawContent || '',
                deviceType: currentDoc.deviceType || 'generic',
                createdAt: currentDoc.createdAt
            };
            
            await db.collection('configurations').replaceOne(
                { _id: config._id },
                newDoc
            );
            console.log(`  Replaced config document`);
        }

        // Force update all Analyses
        console.log('\n=== Force Updating Analyses ===');
        const analyses = await db.collection('analyses').find({}).toArray();
        console.log(`Found ${analyses.length} analyses`);
        
        for (const analysis of analyses) {
            console.log(`Processing analysis ${analysis._id}`);
            
            const currentDoc = await db.collection('analyses').findOne({ _id: analysis._id });
            console.log('Current fields:', Object.keys(currentDoc));
            
            let status = currentDoc.status;
            if (status === 'analyzing') status = 'pending';
            
            const newDoc = {
                _id: currentDoc._id,
                userId: currentDoc.userId,
                configurationId: currentDoc.configurationId,
                results: currentDoc.results || {
                    errors: currentDoc.errors || [],
                    vulnerabilities: currentDoc.vulnerabilities || [],
                    recommendations: currentDoc.recommendations || [],
                    summary: currentDoc.summary || ''
                },
                agentUsed: currentDoc.agentUsed || 'generic',
                processingTime: currentDoc.processingTime || currentDoc.analysisTime || 0,
                status: status,
                createdAt: currentDoc.createdAt
            };
            
            await db.collection('analyses').replaceOne(
                { _id: analysis._id },
                newDoc
            );
            console.log(`  Replaced analysis document`);
        }

        console.log('\n✅ Force migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
