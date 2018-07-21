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
var User                = require('./models/User');
mongoose.connect(process.env.MONGOOSE);

const r = new Snoowrap({
    userAgent: process.env.USER_AGENT,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REDDIT_TOKEN
});
/*
const r = new Snoowrap({
    userAgent: process.env.USER_AGENT,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});
*/
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
  "subreddit": process.env.SUBREDDIT, // optional, defaults to "all",
  "results": 20,        // The number of results to request per request, more the larger the subreddit, about how many results you should get in 2 seconds. Defaults to 5
  "pollTime": 60000
});
 
submissionStream.on("submission", function(post) {
    
  if (post.title && post.title.toLowerCase().indexOf(process.env.PARSE_TEXT) >= 0) {
        
    var title_notag = post.title;
    title_notag = title_notag.replace("[Rewatch]", "");
    title_notag = title_notag.replace("[Spoilers]", "");
    var is_start_group = true;
    var is_discuss_thread = false;
    var rewatch_title = '';
        
    if (post.title.match(/interest|index|schedule/i)) {
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
      is_start_group = false;
          
    } else if (post.title.match(/ - | episode| movie| ova| part /i)) {
          
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
        is_start_group = false;
      }
          
      is_discuss_thread = true;
    }
      
    if (!post.title.match(/\[Rewatch\]/i)) is_start_group = false;
      
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
        if( err ) return console.log( err );
          
        if (post.id) {
          Reddit_Post.findOrCreate({
              id           : post.id
            },{
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
              is_private_messaged: false,
              is_discuss_thread: is_discuss_thread,
              create_time  : Date.now(),
              update_time  : Date.now()
            }, function ( err, reddit_post ){
              if( err ) return console.log( err );
          });
        }
      });
    } else {
      if (post.id) {
        Reddit_Post.findOrCreate({
            id           : post.id
          },{
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
            is_private_messaged: false,
            is_discuss_thread: is_discuss_thread,
            create_time  : Date.now(),
            update_time  : Date.now()
          }, function ( err, reddit_post ){
          if( err ) return console.log( err );
        });
      }
    }
  }
});

cron.schedule('15,45 * * * *', function(){
  //console.log('cronjob update reddit posts');
  var d1 = new Date();
    
  d1.setDate(d1.getDate() - 1);
    
  var query_reddit_post = Reddit_Post.find({
      create_time : {$gt: d1}
  });
  var promise_reddit_post = query_reddit_post.exec();
    
  promise_reddit_post.then(function (reddit_posts) {
    for (i=0; i<reddit_posts.length; i++) {
      var reddit_post = reddit_posts[i];
        
      if (reddit_post.id) {
          
        r.getSubmission(reddit_post.id).expandReplies({limit: Infinity, depth: Infinity}).then(function(post){
          if (post.selftext == '[deleted]' || post.selftext == '[removed]') {
            Reddit_Post.remove({
                id: post.id
            }, function (err, deleted_post) {
              if( err ) return console.log( err );
            });     
          } else {
          
            Reddit_Post.update({
                id: post.id
              }, {
              $push: { 
                comments_over_time: post.num_comments,
                score_over_time: post.score
              },
              $set: { 
                comment_count: post.num_comments,
                score        : post.score,
                update_time : Date.now() 
              }
            }, function (err, updated_reddit_post) {
              if( err ) return console.log( err );
            });
            
            var comment_last_times = {};

            if (typeof post.comments != 'undefined' && post.comments.length > 0) {
                
              for (var post_val in post.comments) {
                if (post.comments[post_val] && post_val != '_r') {
                  if (typeof post.comments[post_val].author != 'undefined') {
                    if (typeof comment_last_times[post.comments[post_val].author.name] == 'undefined' || 
                        comment_last_times[post.comments[post_val].author.name] < post.comments[post_val].created_utc) {
                      comment_last_times[post.comments[post_val].author.name] = post.comments[post_val].created_utc;
                    }
                  }
                    
                  if (
                      typeof post.comments[post_val].replies != 'undefined' &&
                      post.comments[post_val].replies.length > 0
                  ) {
                    for (var replies_val in post.comments[post_val].replies) {
                      if (post.comments[post_val].replies[replies_val] && 
                          typeof post.comments[post_val].replies[replies_val].author != 'undefined' &&
                        (typeof comment_last_times[post.comments[post_val].replies[replies_val].author.name] == 'undefined' || 
                          comment_last_times[post.comments[post_val].replies[replies_val].author.name] < post.comments[post_val].replies[replies_val].created_utc)
                      ) comment_last_times[post.comments[post_val].replies[replies_val].author.name] = post.comments[post_val].replies[replies_val].created_utc;
                    } 
                  }
                }
              } 
                
              for (var post_val in post.comments) {
                if (post.comments[post_val] && post_val != '_r') {
                  if (typeof post.comments[post_val].author != 'undefined') {
                    if (post.comments[post_val].body.toLowerCase().indexOf("[follow]") >= 0) {
                        
                      var author_name = post.comments[post_val].author.name;
                      var comment_time = new Date(post.comments[post_val].created_utc);
                      var comment_last_time = new Date(comment_last_times[author_name]);
                        
                      handle_follow_comments(author_name, comment_last_time, comment_time, post.id);
                    }
                  }
                }
              }
            }
          
            Object.keys(comment_last_times).forEach(function(comment_user_name) {
              var comment_last_time = comment_last_times[comment_user_name];
              
              Reddit_Comment_User.findOne (
              {
                  reddit_post_id: post.id,
                  reddit_name: comment_user_name
              },
              function (err, user) {
                if( err ) return console.log( err );
                  
                if (user) {
                  var d1 = new Date(comment_last_time*1000);  
                  var d2 = new Date(user.last_comment_time);  
                  
                  if (d1.getTime() > d2.getTime()) {
                    
                    Reddit_Comment_User.update({
                        reddit_post_id: post.id,
                        reddit_name: comment_user_name
                      }, {
                        $set: { 
                          last_comment_time: d1,
                          update_time   : Date.now()
                        }
                      }, 
                    function (err, updated_comment_user) {
                      if( err ) return console.log( err );
                    });
                  }
                } else {
                  var d1 = new Date(comment_last_time*1000);  
                  
                  Reddit_Comment_User.create({
                      reddit_post_id: post.id,
                      reddit_name: comment_user_name,
                      first_comment_time: d1,
                      last_comment_time: d1,
                      create_time   : Date.now(),
                      update_time   : Date.now(),
                      is_notified   : false
                    }, 
                  function (err, new_comment_user) {
                    if( err ) return console.log( err );
                  });
                }
              });
            });
          }
        }).catch(function(err) {
          console.log(err);
        });
      }
    }
  });
    
  function handle_follow_comments(comment_author_name, comment_last_time, comment_time, post_id) {
                            
    if (comment_time.getTime() >= comment_last_time.getTime() && (Date.now() - comment_time.getTime()*1000) < 1800000) {
                              
      User.findOrCreate({ name: comment_author_name, reddit_name: comment_author_name }, function (err, user) {
                            
        var query_reddit_post = Reddit_Post.findOne({id : post_id});
        var promise_reddit_post = query_reddit_post.exec();
    
        promise_reddit_post.then(function (reddit_post) {
          if (reddit_post.group_slug) {
            var query_group = Group.findOne({slug : reddit_post.group_slug});
            var promise_group = query_group.exec();
              
            promise_group.then(function (group) {
              var new_attending_users = group.attending_users.slice(0);
      
              if (new_attending_users.indexOf(user.name) == -1) {
                new_attending_users.push(user.name);
      
                Group.update({
                    slug : reddit_post.group_slug
                }, {
                    $set: { 
                        attending_users: new_attending_users, 
                        attending_users_count: new_attending_users.length, 
                        update_time : Date.now() 
                    }
                }, function (err, updated_group) {
                  if( err ) return console.log( err );
        
                  var new_is_allow_private_message;
                  if (user.is_allow_private_message == false) new_is_allow_private_message = false;
                  else new_is_allow_private_message = true;
                                      
                  User.update({
                      name : user.name
                  }, { 
                      $push: {joined_groups: group.slug},
                      $set: {is_allow_private_message: new_is_allow_private_message}
                  }, function (err, updated_user) {
                    if( err ) return console.log( err );
                  });
                });
              }
            });
          } else {
            r.composeMessage({
                to: comment_author_name,
                subject: "This post is not eligible to follow",
                text: '**Error!** The post **' + reddit_post.title + '** does not follow the expected formats (https://rewatchgroups.ga/about) therefore cannot be grouped and followed.  \n  \n *^^This ^^is ^^a ^^message ^^from ^^https://rewatchgroups.ga/.*'
            }).catch(function(err) {
              console.log(err);
            });
          }
        });
      });
    }
  }
});

cron.schedule('23,53 * * * *', function(){ 
  //console.log('cronjob parse unread messages for [unfollow]');
    
  r.getUnreadMessages().then(function(messages){
    if (messages && messages.length > 0) {
      for (var i in messages) {
          
        if (messages[i] && typeof messages[i].body != 'undefined' && messages[i].body.toLowerCase().indexOf("[unfollow]") >= 0) {
          var title = messages[i].subject.replace(" - New post is live!", "");
          title = title.replace("re: ", "");
          var s = title.indexOf(" Rewatch by ");
          var author_name = messages[i].author.name;
          var group_name = title.substring(0, s);
          var user_name = title.substring(s + 12);
            
          var query_group = Group.findOne({name : group_name, admins: user_name});
          var promise_group = query_group.exec();
    
          promise_group.then(function (group) {
            if (group) {
              var new_attending_users = group.attending_users.slice(0);
              var user_index = new_attending_users.indexOf(author_name);
      
              if (user_index != -1) {
                new_attending_users.splice(user_index, 1);
      
                Group.update({
                    name : group_name, 
                    admins: user_name
                }, {
                    $set: { 
                        attending_users: new_attending_users, 
                        attending_users_count: new_attending_users.length, 
                        update_time : Date.now() 
                    }
                }, function (err, updated_group) {
                  if( err ) return console.log( err );
        
                  User.update({
                      name : author_name
                  }, { 
                      $pull: {joined_groups: group.slug}
                  }, function (err, updated_user) {
                    if( err ) return console.log( err );
                  });
                });
              }
            }
          });
        }
      }
      r.markMessagesAsRead(messages).catch(function(err) {
        console.log(err);
      });
    }
  }).catch(function(err) {
    console.log(err);
  });
});

cron.schedule('*/3 * * * *', function(){
  //console.log('cronjob new post private message');
    
  var query_reddit_posts = Reddit_Post.
    find({
        is_private_messaged: false,
        group_slug: { $ne: null }
    }).
    populate('group');
  var promise_reddit_posts = query_reddit_posts.exec();

  promise_reddit_posts.then(function (reddit_posts_val) {
    for (i=0; i<reddit_posts_val.length; i++) {
        
      if (reddit_posts_val[i].group) {
        var payload = {
          body:  "**" + reddit_posts_val[i].url + "**  \n  \n *^^This ^^is ^^a ^^message ^^from ^^https://rewatchgroups.ga/*  \n *^^To ^^unfollow ^^this ^^rewatch, ^^reply ^^[Unfollow] ^^to ^^this ^^message ^^or ^^visit ^^https://rewatchgroups.ga/*  \n *^^You ^^can ^^also ^^switch ^^to ^^browser ^^notifications ^^at ^^https://rewatchgroups.ga/user/settings*",
          title: reddit_posts_val[i].group.name + " Rewatch by " + reddit_posts_val[i].reddit_name + " - New post is live!"
        };    
        
        var all_users = reddit_posts_val[i].group.admins.concat(reddit_posts_val[i].group.attending_users);
        
        send_private_message_reminder(payload, all_users);
      }
    }
  });
    
  Reddit_Post.update({
      is_private_messaged: false,
      group_slug: { $ne: null }
  }, {
      $set: { 
          is_private_messaged: true,
          update_time : Date.now() 
      }
  }, {
      multi: true
  }, function (err, updated_reddit_post) {
    return console.log( err );
  });
    
  function send_private_message_reminder (payload, all_users) {
      
    var query_user = User.find({is_allow_private_message : true, name : {$in: all_users}});
    var promise_user = query_user.exec(); 
      
    promise_user.then(function (user_val) {
      for (ii=0; ii<user_val.length; ii++) {
        r.composeMessage({
            to: user_val[ii].name,
            subject: payload.title,
            text: payload.body
        }).catch(function(err) {
          console.log(err);
        });
      }
    });
  }
});