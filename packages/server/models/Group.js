const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Group name is required'],
        trim: true,
        maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: ''
    },
    avatar: {
        type: String,
        default: null
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure creator is added as admin member
groupSchema.pre('save', function (next) {
    if (this.isNew) {
        const creatorExists = this.members.some(
            member => member.user.toString() === this.creator.toString()
        );

        if (!creatorExists) {
            this.members.push({
                user: this.creator,
                role: 'admin',
                joinedAt: new Date()
            });
        }
    }
    next();
});

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
