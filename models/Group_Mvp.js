var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-find-or-create');
var Schema   = mongoose.Schema;

var Group_Mvp = new Schema({
    group_slug  : String,
    reddit_name : String,
    votes       : Number,
    score_total : Number,
    attend_count: Number,
    create_time : Date,
    update_time : Date    
});

Group_Mvp.plugin(findOrCreate);

module.exports = mongoose.model( 'Group_Mvp', Group_Mvp );