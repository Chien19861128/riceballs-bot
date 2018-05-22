require('dotenv').config();

const Snoowrap = require('snoowrap');
const Snoostorm = require('snoostorm');
var mongoose     = require('mongoose');
var findOrCreate = require('mongoose-find-or-create');
var cron         = require('node-cron');
var slug         = require('slug');

var Reddit_Post         = require('./models/Reddit_Post');
var Reddit_Comment_User = require('./models/Reddit_Comment_User');
var Group               = require('./models/Group');
mongoose.connect(process.env.MONGOOSE);

const r = new Snoowrap({
    userAgent: 'web:ga.rewatchgroups:v0.0.1 (by /u/Dystopian_Overlord)',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});
const client = new Snoostorm(r);

/*
// Configure options for stream: subreddit & results per query
const streamOpts = {
    subreddit: "testingground4bots",
    //subreddit: 'anime',
    results: 25
};
  
// Create a Snoostorm CommentStream with the specified options
const comments = client.CommentStream(streamOpts);

// On comment, perform whatever logic you want to do
comments.on('comment', (comment) => {
    console.log(comment);
});
*/

var submissionStream = client.SubmissionStream({
  //"subreddit": "testingground4bots", // optional, defaults to "all",
  "subreddit": "anime", // optional, defaults to "all",
  "results": 20,        // The number of results to request per request, more the larger the subreddit, about how many results you should get in 2 seconds. Defaults to 5
  "pollTime": 60000
});
 
submissionStream.on("submission", function(post) {
    
  if (post.title && post.title.toLowerCase().indexOf("rewatch") >= 0) {
        
    var title_notag = post.title;
    title_notag = title_notag.replace("[Rewatch]", "");
    title_notag = title_notag.replace("[Spoilers]", "");
    var is_start_group = true;
    var is_discuss_thread = false;
    var rewatch_title = '';
        
    //if (post.title.match(/interest|index/i)) {
    if (post.title.match(/first|index/i)) {
      var l_trimmed_str = title_notag; 
        
      if (title_notag.toLowerCase().indexOf("interest for an ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interest for an ") + 16);
      } else if (title_notag.toLowerCase().indexOf("interest for a ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interest for a ") + 15);
      } else if (title_notag.toLowerCase().indexOf("interest for ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interest for ") + 13);
      } else if (title_notag.toLowerCase().indexOf("interested for an ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interested for an ") + 18);
      } else if (title_notag.toLowerCase().indexOf("interested for a ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interested for a ") + 17);
      } else if (title_notag.toLowerCase().indexOf("interested for ") >= 0) {
        l_trimmed_str = title_notag.substring(title_notag.toLowerCase().indexOf("interested for ") + 15);
      }
        
      if (l_trimmed_str && l_trimmed_str.toLowerCase().indexOf("rewatch") >= 0) {
        rewatch_title = l_trimmed_str.substring(0, l_trimmed_str.toLowerCase().indexOf("rewatch")).trim();
      } else {
        rewatch_title = l_trimmed_str;
      }
          
    } else if (post.title.match(/remind|starts in/i)) {
      var is_start_group = false;
          
    } else if (post.title.match(/episode|movie|ova|part/i)) {
          
      rewatch_title = title_notag; 
          
      if (title_notag.toLowerCase().indexOf(" - ") >= 0) {
        rewatch_title = rewatch_title.substring(0, title_notag.toLowerCase().indexOf(" - ")).trim();
      } else if (title_notag.toLowerCase().indexOf("episode") >= 0) {
        rewatch_title = rewatch_title.substring(0, title_notag.toLowerCase().indexOf("episode")).trim();
      } else if (title_notag.toLowerCase().indexOf("movie") >= 0) {
        rewatch_title = rewatch_title.substring(0, title_notag.toLowerCase().indexOf("movie")).trim();
      } else if (title_notag.toLowerCase().indexOf(" ova ") >= 0) {
        rewatch_title = rewatch_title.substring(0, title_notag.toLowerCase().indexOf(" ova ")).trim();;
      } else if (title_notag.toLowerCase().indexOf("part") >= 0) {
        rewatch_title = rewatch_title.substring(0, title_notag.toLowerCase().indexOf("part")).trim();
      } else {
        var is_start_group = false;
      }
          
      is_discuss_thread = true;
    }
      
    var group_slug = ''    
        
    if (is_start_group && rewatch_title != '') {
      group_slug = slug(post.author.name + ' ' + rewatch_title);
        
      Group.findOrCreate({ 
          slug: group_slug 
      }, 
      {
          slug        : group_slug,
          name        : rewatch_title,
          admins      : [post.author.name],
          series_slugs: [],
          is_active   : true,
          is_bot_made : true,
          //start_time  : start_time,
          create_time : Date.now(),
          update_time : Date.now(),
          attending_users_count: 0
      },
      function (err, group) {
        if( err ) return next( err );
    
        new Reddit_Post({
            id           : post.id,
            title        : post.title,
            subreddit    : post.subreddit.display_name,
            reddit_name  : post.author.name,
            url          : post.url,
            //series_slug  : String,
            group_slug   : group_slug,
            comment_count: post.num_comments,
            score        : post.score,
            //comments_over_time: [],
            //score_over_time: [],
            is_notified  : false,
            is_discuss_thread: is_discuss_thread,
            create_time  : Date.now(),
            update_time  : Date.now()
        }).save( function ( err, reddit_post, count ){
            if( err ) return next( err );
        });
      });
    } else {
      new Reddit_Post({
          id           : post.id,
          title        : post.title,
          subreddit    : post.subreddit.display_name,
          reddit_name  : post.author.name,
          url          : post.url,
          //series_slug  : String,
          group_slug   : group_slug,
          comment_count: post.num_comments,
          score        : post.score,
          //comments_over_time: [],
          //score_over_time: [],
          is_notified  : false,
          is_discuss_thread: is_discuss_thread,
          create_time  : Date.now(),
          update_time  : Date.now()
      }).save( function ( err, reddit_post, count ){
        if( err ) return next( err );
      });
    }
  }
});

cron.schedule('15,45 * * * *', function(){
  var d1 = new Date();
    
  d1.setDate(d1.getDate() - 1);
    
  var query_reddit_post = Reddit_Post.find({
      create_time : {$gt: d1}
  });
  var promise_reddit_post = query_reddit_post.exec();
    
  promise_reddit_post.then(function (reddit_posts) {
    for (i=0; i<reddit_posts.length; i++) {
      var reddit_post = reddit_posts[i];
        
      if (reddit_post.group_slug) {
          
        r.getSubmission(reddit_post.id).expandReplies({limit: Infinity, depth: Infinity}).then(function(post){
          
          Reddit_Post.update({
              id: reddit_post.id
            }, {
            $push: { 
              comments_over_time: reddit_post.num_comments,
              score_over_time: reddit_post.score
            },
            $set: { 
              comment_count: reddit_post.num_comments,
              score        : reddit_post.score,
              update_time : Date.now() 
            }
          }, function (err, updated_reddit_post) {
            if( err ) return next( err );
          });
            
          var comment_users = Array();

          if (typeof post.comments != 'undefined' && post.comments.length > 0) {
            for (var post_val in post.comments) {
              if (post.comments[post_val]) {
                if (typeof post.comments[post_val].author != 'undefined' && comment_users.indexOf(post.comments[post_val].author.name) == -1) comment_users.push(post.comments[post_val].author.name);
                  if (typeof post.comments[post_val].replies != 'undefined' && post.comments[post_val].replies.length > 0) {
                  for (var replies_val in post.comments[post_val].replies) {
                    if (post.comments[post_val].replies[replies_val] && typeof post.comments[post_val].replies[replies_val].author != 'undefined' && comment_users.indexOf(post.comments[post_val].replies[replies_val].author.name) == -1) comment_users.push(post.comments[post_val].replies[replies_val].author.name);
                  } 
                }
              }
            } 
          }
            
          if (comment_users.length > 0) {
            for (var ii in comment_users) {
              Reddit_Comment_User.find (
                {
                    reddit_post_id: reddit_post.id,
                    reddit_name: comment_users[ii]
                }, 
                {
                    comment_count : Number,
                    first_comment_time: Date,
                    last_comment_time: Date,
                    create_time   : Date,
                    update_time   : Date,
                    is_notified   : Boolean
                },
              function (err, user) {
                return done(err, user);
                  
                if (user) {
                  Reddit_Comment_User.update({
                      reddit_post_id: reddit_post.id,
                      reddit_name: comment_users[ii]
                    }, {
                      $set: { 
                        comment_count : (user.comment_count + 1),
                        last_comment_time: Date.now(),
                        update_time   : Date.now()
                      }
                    }, 
                  function (err, updated_comment_user) {
                    if( err ) return next( err );
                  });
                } else {
                  Reddit_Comment_User.create({
                      reddit_post_id: reddit_post.id,
                      reddit_name: comment_users[ii],
                      comment_count : 1,
                      first_comment_time: Date.now(),
                      last_comment_time: Date.now(),
                      create_time   : Date.now(),
                      update_time   : Date.now(),
                      is_notified   : false
                    }, 
                  function (err, new_comment_user) {
                    if( err ) return next( err );
                  });
                }
              });
            }
          }
        });
      }
    }
  });
});